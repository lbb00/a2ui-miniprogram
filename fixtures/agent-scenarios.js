/**
 * A2UI official Agent scenario presets.
 * Associates official test cases with realistic Agent user prompts.
 */

const ALL_CASES = require('./official-all-cases');

const AGENT_SCENARIOS = [
  {
    prompt: 'Recommend 4 top-rated New York specialty restaurants with instant booking',
    caseFile: '00_incremental.json',
    title: 'Restaurant Finder & Booking',
    category: 'Local Life',
  },
  {
    prompt: 'Check live flight status from Beijing Capital (PEK) to Shanghai Hongqiao (SHA)',
    caseFile: '01_flight-status.json',
    title: 'Live Flight Status',
    category: 'Travel',
  },
  {
    prompt: 'View Sony wireless noise-canceling headphones details and reviews',
    caseFile: '05_product-card.json',
    title: 'Product Card',
    category: 'E-Commerce',
  },
  {
    prompt: 'View Mediterranean Quinoa Bowl recipe and preparation steps',
    caseFile: '24_recipe-card.json',
    title: 'Recipe Guide',
    category: 'Cooking',
  },
  {
    prompt: 'Draft an email regarding the quarterly project retrospective',
    caseFile: '02_email-compose.json',
    title: 'Email Composer',
    category: 'Productivity',
  },
  {
    prompt: 'Show my daily schedule and meeting reminders for today',
    caseFile: '03_calendar-day.json',
    title: 'Calendar Schedule',
    category: 'Time Management',
  },
  {
    prompt: 'Check global financial assets performance and yield grid',
    caseFile: '33_financial-data-grid.json',
    title: 'Financial Data Grid',
    category: 'Finance',
  },
];

module.exports = {
  AGENT_SCENARIOS,
  ALL_CASES,
};
