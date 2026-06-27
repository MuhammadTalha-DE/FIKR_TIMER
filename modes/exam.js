/**
 * ============================================================
 * Fikr Timer · Exam Mode Module
 * Specialized timer for exam conditions with per‑question
 * timing, section management, and progress tracking.
 * ============================================================
 *
 * Features:
 *  - Total exam duration with section breakdowns
 *  - Per‑question timer with auto‑calculated time allocation
 *  - Multiple sections with different question counts
 *  - Time warnings (halfway, 5‑minute, 1‑minute)
 *  - Question navigation (skip, mark for review)
 *  - Answered/unanswered/marked question tracking
 *  - Section transition alerts
 *  - Time bank (borrow time from easier sections)
 *  - Practice mode (untimed)
 *  - Realistic exam simulation with countdown
 *  - Post‑exam analytics (time per question, accuracy)
 *
 * Usage:
 *   const exam = new ExamEngine(config);
 *   exam.addSection('Math', 20, 45); // 20 questions, 45 minutes
 *   exam.addSection('Verbal', 30, 50);
 *   exam.start();
 *   exam.answerQuestion('correct'); // or 'incorrect', 'skipped'
 *   exam.nextQuestion();
 *   const report = exam.endExam();
 */

import { playSound, formatTime, generateId } from '../utils.js';
import { StorageManager } from '../storage.js';

// ---------- EXAM MODES ----------
const EXAM_MODES = {
    timed: {
        name: 'Timed Exam',
        description: 'Full exam simulation with strict time limits.',
        allowTimeExtension: false,
    },
    practice: {
        name: 'Practice Mode',
        description: 'Untimed practice with question tracking.',
        allowTimeExtension: true,
        untimed: true,
    },
    adaptive: {
        name: 'Adaptive Timing',
        description: 'Adjusts time per question based on difficulty.',
        allowTimeExtension: true,
    },
};

// ---------- QUESTION STATUS ----------
const QUESTION_STATUS = {
    UNANSWERED: 'unanswered',
    ANSWERED: 'answered',
    MARKED: 'marked',
    SKIPPED: 'skipped',
    REVIEW: 'review',
};

// ---------- ANSWER RESULT ----------
const ANSWER_RESULT = {
    CORRECT: 'correct',
    INCORRECT: 'incorrect',
    SKIPPED: 'skipped',
    PENDING: 'pending',
};

// ---------- PHASES ----------
const PHASES = {
    PRE_EXAM: 'preExam',
    IN_PROGRESS: 'inProgress',
    BETWEEN_SECTIONS: 'betweenSections',
    COMPLETED: 'completed',
};

// ---------- EXAM ENGINE ----------
export class ExamEngine {
    constructor(config = {}) {
        this.storage = new StorageManager();

        // Exam configuration
        this.examMode = config.mode || 'timed';
        this.examName = config.name || 'Exam';
        this.subject = config.subject || '';
        this.totalSections = 0;

        // Sections array
        this.sections = [];
        this.currentSectionIndex = 0;

        // Features
        this.soundEnabled = config.soundEnabled !== false;
        this.notificationsEnabled = config.notificationsEnabled !== false;
        this.showTimer = config.showTimer !== false;
        this.showQuestionTimer = config.showQuestionTimer !== false;
        this.timeWarnings = config.timeWarnings !== false;
        this.autoAdvanceSections = config.autoAdvanceSections || false;

        // State
        this.phase = PHASES.PRE_EXAM;
        this.timeLeft = 0;
        this.sectionTimeLeft = 0;
        this.totalDuration = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.sessionId = null;
        this.sessionStartTime = null;

        // Current question
        this.currentQuestionNumber = 1;
        this.questionTimeLeft = 0;
        this.questionStartTime = null;

        // Tracking per section
        this.sectionProgress = [];

        // Global tracking
        this.questions = {}; // questionId -> { status, answer, timeSpent, ... }

        // Warnings triggered
        this.warningsTriggered = [];

        // Interval
        this._interval = null;

        // Callbacks
        this.onTick = null;                // (timeLeft, sectionTimeLeft, questionTimeLeft)
        this.onQuestionChange = null;      // (questionNumber, totalInSection)
        this.onSectionChange = null;       // (sectionIndex, section)
        this.onWarning = null;             // (warningType, timeRemaining)
        this.onComplete = null;            // (examReport)
        this.onAnswerRecorded = null;      // (questionNumber, result)
    }

    // ---------- PUBLIC API ----------

    /**
     * Add a section to the exam.
     * @param {string} name - Section name
     * @param {number} questionCount - Number of questions
     * @param {number} timeMinutes - Time allocated in minutes
     * @param {number} difficulty - Difficulty multiplier (1-3)
     */
    addSection(name, questionCount, timeMinutes, difficulty = 1) {
        const timePerQuestion = Math.floor((timeMinutes * 60) / questionCount);

        const section = {
            id: this.sections.length,
            name,
            questionCount,
            totalTime: timeMinutes * 60,
            timePerQuestion,
            difficulty,
            questions: [],
        };

        // Initialize questions for this section
        for (let i = 0; i < questionCount; i++) {
            const questionId = `${section.id}-${i + 1}`;
            section.questions.push({
                id: questionId,
                number: i + 1,
                status: QUESTION_STATUS.UNANSWERED,
                result: ANSWER_RESULT.PENDING,
                timeSpent: 0,
                startTime: null,
            });

            this.questions[questionId] = section.questions[i];
        }

        this.sections.push(section);
        this.totalSections = this.sections.length;
        this.totalDuration += section.totalTime;

        return section;
    }

    /**
     * Start the exam.
     */
    start() {
        if (this.isRunning || this.sections.length === 0) return;

        this.sessionId = generateId();
        this.sessionStartTime = Date.now();
        this.phase = PHASES.IN_PROGRESS;
        this.currentSectionIndex = 0;
        this.currentQuestionNumber = 1;
        this.isRunning = true;
        this.isPaused = false;

        this._loadSection(0);
        this._startTimer();

        this._notify('Exam Started', `${this.examName} has begun. Good luck! 📝`);

        return this;
    }

    /**
     * Pause the exam.
     */
    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        this._pauseQuestionTimer();
        clearInterval(this._interval);
        this._interval = null;
        return this;
    }

    /**
     * Resume the exam.
     */
    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this._resumeQuestionTimer();
        this._startTimer();
        return this;
    }

    /**
     * Move to the next question.
     */
    nextQuestion() {
        const section = this._getCurrentSection();
        if (!section) return false;

        // Save current question time
        this._endQuestionTimer();

        if (this.currentQuestionNumber >= section.questionCount) {
            // End of section
            this._handleSectionEnd();
        } else {
            this.currentQuestionNumber++;
            this._startQuestionTimer();

            if (this.onQuestionChange) {
                this.onQuestionChange(this.currentQuestionNumber, section.questionCount);
            }
        }

        return true;
    }

    /**
     * Go to a specific question.
     */
    goToQuestion(number) {
        const section = this._getCurrentSection();
        if (!section || number < 1 || number > section.questionCount) return false;

        this._endQuestionTimer();
        this.currentQuestionNumber = number;
        this._startQuestionTimer();

        if (this.onQuestionChange) {
            this.onQuestionChange(this.currentQuestionNumber, section.questionCount);
        }

        return true;
    }

    /**
     * Record answer for current question.
     */
    answerQuestion(result = ANSWER_RESULT.CORRECT) {
        const question = this._getCurrentQuestion();
        if (!question) return false;

        question.result = result;
        question.status = QUESTION_STATUS.ANSWERED;

        if (this.onAnswerRecorded) {
            this.onAnswerRecorded(this.currentQuestionNumber, result);
        }

        return true;
    }

    /**
     * Mark current question for review.
     */
    markForReview() {
        const question = this._getCurrentQuestion();
        if (!question) return false;

        question.status = QUESTION_STATUS.MARKED;
        return true;
    }

    /**
     * Skip current question.
     */
    skipQuestion() {
        const question = this._getCurrentQuestion();
        if (!question) return false;

        question.status = QUESTION_STATUS.SKIPPED;
        question.result = ANSWER_RESULT.SKIPPED;
        return this.nextQuestion();
    }

    /**
     * Extend section time (if allowed).
     */
    extendTime(minutes = 5) {
        if (this.examMode === 'timed') return false;
        this.timeLeft += minutes * 60;
        this.sectionTimeLeft += minutes * 60;
        const section = this._getCurrentSection();
        if (section) section.totalTime += minutes * 60;
        return true;
    }

    /**
     * End the exam early.
     */
    endExam() {
        this._endQuestionTimer();
        const report = this._generateReport();
        this.isRunning = false;
        this.isPaused = false;
        this.phase = PHASES.COMPLETED;
        clearInterval(this._interval);
        this._interval = null;

        this._saveSession(report);

        if (this.onComplete) this.onComplete(report);
        return report;
    }

    /**
     * Get current state.
     */
    getState() {
        const section = this._getCurrentSection();
        return {
            phase: this.phase,
            sectionIndex: this.currentSectionIndex,
            sectionName: section ? section.name : '',
            currentQuestion: this.currentQuestionNumber,
            totalQuestionsInSection: section ? section.questionCount : 0,
            timeLeft: this.timeLeft,
            sectionTimeLeft: this.sectionTimeLeft,
            questionTimeLeft: this.questionTimeLeft,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            progress: this._getOverallProgress(),
            sectionProgress: this._getSectionProgress(),
            answeredCount: this._getAnsweredCount(),
            markedCount: this._getMarkedCount(),
            skippedCount: this._getSkippedCount(),
        };
    }

    /**
     * Get question statistics.
     */
    getQuestionStats() {
        const section = this._getCurrentSection();
        if (!section) return null;

        const answered = section.questions.filter(q => q.status === QUESTION_STATUS.ANSWERED).length;
        const marked = section.questions.filter(q => q.status === QUESTION_STATUS.MARKED).length;
        const skipped = section.questions.filter(q => q.status === QUESTION_STATUS.SKIPPED).length;
        const unanswered = section.questions.filter(q => q.status === QUESTION_STATUS.UNANSWERED).length;

        return {
            total: section.questionCount,
            answered,
            marked,
            skipped,
            unanswered,
            averageTimePerQuestion: this._getAverageTimePerQuestion(),
            remainingTimePerQuestion: unanswered > 0
                ? Math.floor(this.sectionTimeLeft / unanswered)
                : 0,
        };
    }

    // ---------- PRIVATE METHODS ----------

    _getCurrentSection() {
        return this.sections[this.currentSectionIndex] || null;
    }

    _getCurrentQuestion() {
        const section = this._getCurrentSection();
        if (!section) return null;
        return section.questions[this.currentQuestionNumber - 1] || null;
    }

    _loadSection(index) {
        const section = this.sections[index];
        if (!section) return;

        this.sectionTimeLeft = section.totalTime;
        this.currentQuestionNumber = 1;
        this._startQuestionTimer();

        if (this.onSectionChange) {
            this.onSectionChange(index, section);
        }
    }

    _startQuestionTimer() {
        const section = this._getCurrentSection();
        this.questionTimeLeft = section ? section.timePerQuestion : 60;
        this.questionStartTime = Date.now();
    }

    _pauseQuestionTimer() {
        if (this.questionStartTime) {
            const elapsed = Math.round((Date.now() - this.questionStartTime) / 1000);
            const question = this._getCurrentQuestion();
            if (question) {
                question.timeSpent += elapsed;
            }
        }
    }

    _resumeQuestionTimer() {
        this.questionStartTime = Date.now();
    }

    _endQuestionTimer() {
        if (this.questionStartTime) {
            const elapsed = Math.round((Date.now() - this.questionStartTime) / 1000);
            const question = this._getCurrentQuestion();
            if (question) {
                question.timeSpent += elapsed;
            }
            this.questionStartTime = null;
        }
    }

    _startTimer() {
        clearInterval(this._interval);

        this._interval = setInterval(() => {
            // Global time
            if (this.timeLeft > 0) this.timeLeft--;
            if (this.sectionTimeLeft > 0) this.sectionTimeLeft--;
            if (this.questionTimeLeft > 0) this.questionTimeLeft--;

            // Time warnings
            this._checkTimeWarnings();

            // Question timer expired
            if (this.questionTimeLeft <= 0 && this.showQuestionTimer) {
                playSound('warning');
                if (this.onWarning) this.onWarning('questionTimeUp', 0);
            }

            // Section time expired
            if (this.sectionTimeLeft <= 0) {
                this._handleSectionEnd();
                return;
            }

            // Global time expired
            if (this.timeLeft <= 0) {
                this.endExam();
                return;
            }

            if (this.onTick) {
                this.onTick(this.timeLeft, this.sectionTimeLeft, this.questionTimeLeft);
            }
        }, 1000);
    }

    _checkTimeWarnings() {
        if (!this.timeWarnings) return;

        const warnings = [
            { type: 'halfway', time: Math.floor(this.sectionTimeLeft / 2), triggered: false },
            { type: 'fiveMinutes', time: 300, triggered: false },
            { type: 'oneMinute', time: 60, triggered: false },
            { type: 'thirtySeconds', time: 30, triggered: false },
        ];

        warnings.forEach(w => {
            if (this.sectionTimeLeft === w.time && !this.warningsTriggered.includes(w.type)) {
                this.warningsTriggered.push(w.type);
                if (this.onWarning) this.onWarning(w.type, w.time);
                playSound('warning');
                this._notify('Time Warning', `${this._getWarningMessage(w.type)}`);
            }
        });
    }

    _getWarningMessage(type) {
        const section = this._getCurrentSection();
        const sectionName = section ? section.name : '';
        switch (type) {
            case 'halfway': return `Halfway through ${sectionName}!`;
            case 'fiveMinutes': return `5 minutes remaining in ${sectionName}!`;
            case 'oneMinute': return `1 minute remaining!`;
            case 'thirtySeconds': return `30 seconds left!`;
            default: return 'Time is running out!';
        }
    }

    _handleSectionEnd() {
        this._endQuestionTimer();

        // Save section progress
        this.sectionProgress.push({
            sectionIndex: this.currentSectionIndex,
            sectionName: this._getCurrentSection()?.name || '',
            questionsAnswered: this._getAnsweredCount(),
            questionsMarked: this._getMarkedCount(),
            questionsSkipped: this._getSkippedCount(),
            timeRemaining: this.sectionTimeLeft,
        });

        this.currentSectionIndex++;

        if (this.currentSectionIndex >= this.sections.length) {
            // All sections complete
            this.endExam();
        } else {
            // Load next section
            this._loadSection(this.currentSectionIndex);
            this.warningsTriggered = [];

            this._notify('Section Complete', `Starting ${this._getCurrentSection()?.name}`);

            if (!this.autoAdvanceSections) {
                this.pause();
            }
        }
    }

    _getOverallProgress() {
        if (this.totalDuration <= 0) return 1;
        return this.timeLeft / this.totalDuration;
    }

    _getSectionProgress() {
        const section = this._getCurrentSection();
        if (!section || section.totalTime <= 0) return 0;
        return this.sectionTimeLeft / section.totalTime;
    }

    _getAnsweredCount() {
        const section = this._getCurrentSection();
        if (!section) return 0;
        return section.questions.filter(q => q.status === QUESTION_STATUS.ANSWERED).length;
    }

    _getMarkedCount() {
        const section = this._getCurrentSection();
        if (!section) return 0;
        return section.questions.filter(q => q.status === QUESTION_STATUS.MARKED).length;
    }

    _getSkippedCount() {
        const section = this._getCurrentSection();
        if (!section) return 0;
        return section.questions.filter(q => q.status === QUESTION_STATUS.SKIPPED).length;
    }

    _getAverageTimePerQuestion() {
        const section = this._getCurrentSection();
        if (!section) return 0;
        const answered = section.questions.filter(q => q.timeSpent > 0);
        if (answered.length === 0) return 0;
        const totalTime = answered.reduce((sum, q) => sum + q.timeSpent, 0);
        return Math.round(totalTime / answered.length);
    }

    _notify(title, body) {
        if (!this.notificationsEnabled) return;
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }

    _generateReport() {
        const totalElapsed = Math.round((Date.now() - this.sessionStartTime) / 1000);

        // Aggregate section data
        const sectionReports = this.sections.map((section, index) => {
            const answered = section.questions.filter(q => q.status === QUESTION_STATUS.ANSWERED);
            const correct = section.questions.filter(q => q.result === ANSWER_RESULT.CORRECT);
            const incorrect = section.questions.filter(q => q.result === ANSWER_RESULT.INCORRECT);
            const skipped = section.questions.filter(q => q.result === ANSWER_RESULT.SKIPPED);
            const totalTimeSpent = section.questions.reduce((sum, q) => sum + q.timeSpent, 0);

            return {
                sectionIndex: index,
                sectionName: section.name,
                questionCount: section.questionCount,
                answered: answered.length,
                correct: correct.length,
                incorrect: incorrect.length,
                skipped: skipped.length,
                accuracy: answered.length > 0
                    ? Math.round((correct.length / answered.length) * 100)
                    : 0,
                averageTimePerQuestion: answered.length > 0
                    ? Math.round(totalTimeSpent / answered.length)
                    : 0,
                totalTimeSpent,
                timeAllocated: section.totalTime,
                timeRemaining: Math.max(0, section.totalTime - totalTimeSpent),
            };
        });

        // Overall stats
        const allQuestions = this.sections.flatMap(s => s.questions);
        const totalAnswered = allQuestions.filter(q => q.status === QUESTION_STATUS.ANSWERED).length;
        const totalCorrect = allQuestions.filter(q => q.result === ANSWER_RESULT.CORRECT).length;
        const totalQuestions = allQuestions.length;
        const totalTimeSpent = allQuestions.reduce((sum, q) => sum + q.timeSpent, 0);

        return {
            sessionId: this.sessionId,
            type: 'exam',
            examMode: this.examMode,
            examName: this.examName,
            subject: this.subject,

            // Timing
            startTime: new Date(this.sessionStartTime).toISOString(),
            endTime: new Date().toISOString(),
            totalDurationSeconds: totalElapsed,
            totalDurationMinutes: Math.round(totalElapsed / 60 * 10) / 10,
            totalAllocatedTime: this.totalDuration,

            // Overall stats
            totalSections: this.sections.length,
            totalQuestions,
            totalAnswered,
            totalCorrect,
            totalIncorrect: allQuestions.filter(q => q.result === ANSWER_RESULT.INCORRECT).length,
            totalSkipped: allQuestions.filter(q => q.result === ANSWER_RESULT.SKIPPED).length,
            overallAccuracy: totalAnswered > 0
                ? Math.round((totalCorrect / totalAnswered) * 100)
                : 0,
            averageTimePerQuestion: totalAnswered > 0
                ? Math.round(totalTimeSpent / totalAnswered)
                : 0,

            // Section breakdown
            sections: sectionReports,

            // Time management
            totalTimeSpent,
            timeEfficiency: this.totalDuration > 0
                ? Math.round((totalTimeSpent / this.totalDuration) * 100)
                : 0,

            // Warnings
            warningsTriggered: this.warningsTriggered,
        };
    }

    async _saveSession(report) {
        try {
            const history = await this.storage.get('examHistory') || [];
            history.unshift(report);
            await this.storage.set('examHistory', history.slice(0, 100));
        } catch (err) {
            console.error('Failed to save exam session:', err);
        }
    }

    // ---------- STATIC METHODS ----------

    /**
     * Get exam modes.
     */
    static getExamModes() {
        return Object.keys(EXAM_MODES).map(key => ({
            id: key,
            ...EXAM_MODES[key],
        }));
    }

    /**
     * Get answer result options.
     */
    static getAnswerResults() {
        return ANSWER_RESULT;
    }

    /**
     * Get question status options.
     */
    static getQuestionStatuses() {
        return QUESTION_STATUS;
    }

    /**
     * Get lifetime exam statistics.
     */
    static async getStatistics(storage = new StorageManager()) {
        const history = await storage.get('examHistory') || [];

        if (history.length === 0) {
            return {
                totalExams: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                overallAccuracy: 0,
                averageTimePerQuestion: 0,
                subjectStats: {},
            };
        }

        const totalQuestions = history.reduce((sum, s) => sum + (s.totalQuestions || 0), 0);
        const totalCorrect = history.reduce((sum, s) => sum + (s.totalCorrect || 0), 0);
        const totalAnswered = history.reduce((sum, s) => sum + (s.totalAnswered || 0), 0);

        const subjectStats = {};
        history.forEach(s => {
            if (s.subject) {
                if (!subjectStats[s.subject]) {
                    subjectStats[s.subject] = { exams: 0, totalQuestions: 0, totalCorrect: 0 };
                }
                subjectStats[s.subject].exams++;
                subjectStats[s.subject].totalQuestions += (s.totalQuestions || 0);
                subjectStats[s.subject].totalCorrect += (s.totalCorrect || 0);
            }
        });

        return {
            totalExams: history.length,
            totalQuestions,
            totalCorrect,
            overallAccuracy: totalAnswered > 0
                ? Math.round((totalCorrect / totalAnswered) * 100)
                : 0,
            averageTimePerQuestion: totalAnswered > 0
                ? Math.round(
                    history.reduce((sum, s) => sum + (s.averageTimePerQuestion || 0), 0) /
                    history.length
                )
                : 0,
            subjectStats,
        };
    }
}

export default ExamEngine;
