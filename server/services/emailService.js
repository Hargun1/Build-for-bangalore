const nodemailer = require("nodemailer");

// Configure Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER || "hargunmadan9034@gmail.com",
    pass: process.env.GMAIL_PASSWORD, // App password (16 characters)
  },
});

/**
 * Send email verification OTP
 */
const sendVerificationEmail = async (email, verificationOtp) => {

  const mailOptions = {
    from: process.env.GMAIL_USER || "hargunmadan9034@gmail.com",
    to: email,
    subject: "Your PranexusAI verification code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Thank you for registering with PranexusAI.</p>
        <p>Use the following one-time code to verify your email:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0f766e; margin: 18px 0;">
          ${verificationOtp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>Enter this code on the Verify Email screen in the app.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to send verification email: ${error.message}`);
    throw error;
  }
};

/**
 * Send password reset email
 */
const sendResetEmail = async (email, resetToken) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.GMAIL_USER || "hargunmadan9034@gmail.com",
    to: email,
    subject: "Reset Your Password - Build For Bangalore Health App",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px;">
          Reset Password
        </a>
        <p>Or copy this link: <a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to send reset email: ${error.message}`);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendResetEmail,
};
