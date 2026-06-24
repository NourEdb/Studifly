const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const coursesRoutes = require('./routes/courses.routes');
const tasksRoutes = require('./routes/tasks.routes');
const sessionsRoutes = require('./routes/sessions.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const gamificationRoutes = require('./routes/gamification.routes');
const aiCoachRoutes      = require('./routes/ai-coach.routes');
const eventsRoutes       = require('./routes/events.routes');
const exportRoutes       = require('./routes/export.routes');
const studyBlocksRoutes  = require('./routes/study-blocks.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/ai-coach',    aiCoachRoutes);
app.use('/api/events',      eventsRoutes);
app.use('/api/export',       exportRoutes);
app.use('/api/study-blocks', studyBlocksRoutes);

app.use(errorHandler);

module.exports = app;
