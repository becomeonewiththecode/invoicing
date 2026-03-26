import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import clientRoutes from './routes/clients';
import invoiceRoutes from './routes/invoices';
import shareRoutes from './routes/share';
import discountRoutes from './routes/discounts';
import settingsRoutes from './routes/settings';
import dataPortRoutes from './routes/dataPort';
import adminRoutes from './routes/admin/index';
import ticketRoutes from './routes/tickets';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use('/api/data', express.json({ limit: '15mb' }), dataPortRoutes);
app.use(express.json());
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', projectRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices/share', shareRoutes); // public — must be before authenticated invoice routes
app.use('/api/invoices', invoiceRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
