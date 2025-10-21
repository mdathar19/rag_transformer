const fs = require('fs');
const path = require('path');
const transporter = require('./transporter');

/**
 * Send OTP verification email
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.otp - OTP code
 * @returns {Promise} - Nodemailer sendMail promise
 */
exports.sendOtpEmail = async (params) => {
  try {
    const { email, otp } = params;

    // Read the email template
    const templatePath = path.join(__dirname, './templates/verifyOtp.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables
    htmlContent = htmlContent.replace(/{{email}}/g, email);
    htmlContent = htmlContent.replace(/{{otp}}/g, otp);

    // Send email
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@runit.in',
      to: email,
      subject: 'RunIt Lab - Email Verification OTP',
      html: htmlContent
    });

    console.log('[Email] OTP sent successfully to:', email);
    return result;
  } catch (error) {
    console.error('[Email] Error sending OTP email:', error);
    throw error;
  }
};

/**
 * Send welcome email after successful registration
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.companyName - Company name
 * @returns {Promise} - Nodemailer sendMail promise
 */
exports.sendWelcomeEmail = async (params) => {
  try {
    const { email, companyName } = params;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
              }
              .container {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  border-radius: 10px;
                  padding: 30px;
                  color: white;
              }
              .content {
                  background-color: white;
                  border-radius: 8px;
                  padding: 30px;
                  margin-top: 20px;
                  color: #333;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🎉 Welcome to RunIt Lab!</h1>
          </div>
          <div class="content">
              <p>Hi <strong>${companyName}</strong>,</p>
              <p>Thank you for joining RunIt Lab!</p>
              <p>You can now start adding websites, crawling content, and querying your data using our AI-powered RAG system.</p>
              <p><strong>Get Started:</strong></p>
              <ul>
                  <li>Add your first website</li>
                  <li>Crawl and index content</li>
                  <li>Start asking questions</li>
              </ul>
              <p>If you need any help, feel free to reach out to our support team.</p>
          </div>
      </body>
      </html>
    `;

    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@runit.in',
      to: email,
      subject: 'Welcome to RunIt Lab!',
      html: htmlContent
    });

    console.log('[Email] Welcome email sent to:', email);
    return result;
  } catch (error) {
    console.error('[Email] Error sending welcome email:', error);
    // Don't throw error for welcome email, it's not critical
    return { error: true, message: error.message };
  }
};

module.exports = exports;
