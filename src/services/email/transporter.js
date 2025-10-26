const nodemailer = require('nodemailer');

// Configure nodemailer transporter for GoDaddy email with Outlook
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtpout.secureserver.net', // GoDaddy SMTP server
  port: process.env.EMAIL_PORT || 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER || 'support@ragsense.co',
    pass: process.env.EMAIL_PASSWORD // Should be set in environment variables
  },
  tls: {
    rejectUnauthorized: false // Needed for some GoDaddy configurations
  }
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error('[Email] Transporter error:', error);
  } else {
    console.log('[Email] Server is ready to send messages');
  }
});

module.exports = transporter;
