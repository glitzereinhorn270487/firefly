import express from 'express';
import alphaTuner from '../api/alpha-tuner';

export function registerAlphaTuner(app: express.Application) {
  app.use('/api/alpha-tuner', alphaTuner);
}