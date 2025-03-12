// Load environment variables from .env file
require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const nodemailer = require('nodemailer');

const app = express();

// Get port from environment variable or use 8000 as fallback
const PORT = process.env.PORT || 8000;

// Global variable to track email server status
let emailServerStatus = false;

// Function to verify email configuration
const verifyEmailServer = async () => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Verify email connection
        await transporter.verify();
        emailServerStatus = true;
        console.log('✅ Email server is ready to send messages');
        return true;
    } catch (error) {
        emailServerStatus = false;
        console.error('❌ Email server verification failed:', error.message);
        return false;
    }
};

// MongoDB connection options to fix buffering timeout issues
const mongoOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
};

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI;
let dbStatus = false;

const ConnectDB = async () => {
    try {
        await mongoose.connect(mongoURI, mongoOptions);
        dbStatus = true;
        console.log("✅ MongoDB Connected Successfully");
        return true;
    } catch (err) {
        dbStatus = false;
        console.error("❌ MongoDB Connection Error:", err.message);
        console.log("🔄 Retrying connection in 5 seconds...");
        setTimeout(ConnectDB, 5000);
        return false;
    }
};

// Handle MongoDB connection events
mongoose.connection.on("error", (err) => {
    dbStatus = false;
    console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
    dbStatus = false;
    console.log("❌ MongoDB disconnected. Attempting to reconnect...");
    ConnectDB();
});

mongoose.connection.on("connected", () => {
    dbStatus = true;
    console.log("✅ MongoDB connection established");
});

// CORS middleware with more secure configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://impexinfo.com'] // Replace with your actual frontend domain
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware to parse JSON bodies
app.use(express.json({ limit: "10mb" })); // Increase payload limit
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ==================== MODELS ====================

/**
 * Blog Schema
 * Defines the structure for blog documents in MongoDB
 * Fields:
 * - title: String (required)
 * - description: String (required)
 * - category: String (required)
 * - imageUrl: String (required)
 * - status: String (enum: ['published', 'draft'], default: 'draft')
 * - createdAt: Date (automatically set)
 * - updatedAt: Date (automatically updated)
 */
const BlogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Blog title is required'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Blog description is required'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Blog category is required'],
        trim: true
    },
    imageUrl: {
        type: String,
        required: [true, 'Blog image URL is required'],
        trim: true
    },
    status: {
        type: String,
        enum: ['published', 'draft'],
        default: 'draft'
    }
}, {
    timestamps: true // Automatically create createdAt and updatedAt fields
});

const Blog = mongoose.model('Blog', BlogSchema);

// ==================== MIDDLEWARE ====================

/**
 * Error Handler Middleware
 * Handles errors throughout the application
 */
const errorHandler = (err, req, res, next) => {
    // Log error for server-side debugging
    console.error(err.stack);
    
    // Default error status and message
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

// ==================== CONTROLLERS ====================

/**
 * Blog Controller
 * Contains all the CRUD operations for blog posts
 */

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
const getBlogs = async (req, res, next) => {
    try {
        // Add query parameters for filtering
        const filter = {};
        
        // Filter by status if provided
        if (req.query.status) {
            filter.status = req.query.status;
        }
        
        // Filter by category if provided
        if (req.query.category) {
            filter.category = req.query.category;
        }
        
        const blogs = await Blog.find(filter).sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            count: blogs.length,
            data: blogs
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single blog
// @route   GET /api/blogs/:id
// @access  Public
const getBlog = async (req, res, next) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({
                success: false,
                error: 'Blog not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: blog
        });
    } catch (error) {
        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid blog ID format'
            });
        }
        next(error);
    }
};

// @desc    Create new blog
// @route   POST /api/blogs
// @access  Public (would typically be Private in a real app)
const createBlog = async (req, res, next) => {
    try {
        // Validate required fields
        const { title, description, category, status, imageUrl } = req.body;
        
        if (!title || !description || !category || !status || !imageUrl) {
            return res.status(400).json({
                success: false,
                error: 'Please provide title, description, category, status, and imageUrl'
            });
        }
        
        // Validate status value
        if (status !== 'published' && status !== 'draft') {
            return res.status(400).json({
                success: false,
                error: 'Status must be either "published" or "draft"'
            });
        }
        
        const blog = await Blog.create(req.body);
        
        res.status(201).json({
            success: true,
            data: blog
        });
    } catch (error) {
        // Handle validation errors from Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages
            });
        }
        next(error);
    }
};

// @desc    Update blog
// @route   PUT /api/blogs/:id
// @access  Public (would typically be Private in a real app)
const updateBlog = async (req, res, next) => {
    try {
        let blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({
                success: false,
                error: 'Blog not found'
            });
        }
        
        // Update the blog
        blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
            new: true,           // Return the updated document
            runValidators: true  // Run model validators
        });
        
        res.status(200).json({
            success: true,
            data: blog
        });
    } catch (error) {
        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid blog ID format'
            });
        }
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages
            });
        }
        next(error);
    }
};

// @desc    Delete blog
// @route   DELETE /api/blogs/:id
// @access  Public (would typically be Private in a real app)
const deleteBlog = async (req, res, next) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({
                success: false,
                error: 'Blog not found'
            });
        }
        
        await blog.deleteOne();
        
        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid blog ID format'
            });
        }
        next(error);
    }
};

/**
 * Contact Controller
 * Handles contact form submissions and email sending
 */

// @desc    Submit contact form and send emails
// @route   POST /api/contact
// @access  Public
const submitContactForm = async (req, res, next) => {
    try {
        // Extract form data
        const { name, email, phone, message } = req.body;

        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                error: 'Please provide name, email and message'
            });
        }

        // Create email transporter using Gmail SMTP
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER, // Gmail address from .env
                pass: process.env.EMAIL_PASS  // App password from .env
            }
        });

        // Create HTML template for user confirmation email
        const userEmailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
<!-- Header with gradient background -->
<div style="background: linear-gradient(to right, #0052D4, #4364F7, #6FB1FC); padding: 30px 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-weight: 700; font-size: 30px;">ImpexInfo</h1>
    <h3 style="color: white; margin: 0; font-weight: 500; font-size: 24px;">Thank You for Contacting Us!</h3>
</div>

<!-- Main content area -->
<div style="background-color: #ffffff; padding: 30px 25px;">
    <p style="color: #333; font-size: 16px; line-height: 1.5; margin-top: 0;">Dear <strong>${name}</strong>,</p>
    
    <p style="color: #333; font-size: 16px; line-height: 1.5;">We have received your message and appreciate your interest in Impex Info. Our team will review your inquiry and get back to you within 24 hours.</p>
    
    <!-- Message details section -->
    <div style="background-color: #f8f9fa; border-left: 4px solid #4364F7; padding: 20px; border-radius: 4px; margin: 25px 0;">
        <h3 style="color: #0052D4; margin-top: 0; font-size: 18px;">Your Message Details:</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
                <td style="padding: 8px 0; color: #555; font-weight: bold; width: 80px;">Name:</td>
                <td style="padding: 8px 0; color: #333;">${name}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #555; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0; color: #333;">${email}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #555; font-weight: bold;">Phone:</td>
                <td style="padding: 8px 0; color: #333;">${phone || 'Not provided'}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #555; font-weight: bold; vertical-align: top;">Message:</td>
                <td style="padding: 8px 0; color: #333;">${message}</td>
            </tr>
        </table>
    </div>
    
    <p style="color: #333; font-size: 16px; line-height: 1.5;">While you wait for our response, feel free to explore our global trade intelligence platform that provides import-export data from 209 countries.</p>
    
    <div style="text-align: center;">
        <a href="https://impexinfo.com/plans" style="display: inline-block; background: linear-gradient(to right, #0052D4, #4364F7); color: white; text-decoration: none; padding: 12px 25px; border-radius: 4px; font-weight: 600; font-size: 16px;">Explore Our Plans</a>
    </div>
    
    <p style="color: #333; margin-top: 10px; line-height: 1.5;">Best regards,<br><strong>The Impex Info Team</strong></p>
</div>

<!-- Footer -->
<div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
    <p style="margin: 0 0 15px 0; color: #6c757d; font-size: 14px;">This is an automated message. Please do not reply to this email.</p>
    
    <!-- Social icons -->
    <div style="margin-bottom: 15px;">
        <a href="https://facebook.com/impexinfo" style="display: inline-block; margin: 0 8px; color:"Black"> Facebook</a>
        <a href="https://linkedin.com/impexinfo" style="display: inline-block; margin: 0 8px; color:"Black"> Linkedin</a>
        <a href="https://twitter.com/impexinfo" style="display: inline-block; margin: 0 8px; color:"Black"> Twitter</a>
    </div>
    
    <p style="margin: 0; color: #6c757d; font-size: 13px;">&copy; 2024 Impex Info by <span style="color: Black; font-size: 15px;">Aashita TechnoSoft</span>. All rights reserved.</p>
</div>
</div>
    `;

        // Create HTML template for admin notification email
        const adminEmailHtml = `
           <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
    <!-- Admin Header -->
    <div style="background: linear-gradient(to right, #0052D4, #4364F7, #6FB1FC); padding: 20px 25px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td>
                    <h2 style="color: white; margin: 0; font-weight: 600; font-size: 22px;">New Contact Form Submission</h2>
                </td>
                <td align="right">
                    <span style="color: white; background-color: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;">ADMIN NOTIFICATION</span>
                </td>
            </tr>
        </table>
    </div>
    
    <!-- Content Area -->
    <div style="background-color: #ffffff; padding: 25px;">
        <!-- Alert Badge -->
        <div style="background-color: #e8f4fd; border-left: 4px solid #4364F7; padding: 12px 15px; margin-bottom: 25px; border-radius: 4px;">
            <p style="margin: 0; color: #0052D4; font-size: 14px;">
                <strong>Action Required:</strong> New customer inquiry received. Please review and respond promptly.
            </p>
        </div>
        
        <!-- Contact Information Box -->
        <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
            <div style="background-color: #f1f3f5; padding: 12px 20px; border-bottom: 1px solid #e9ecef;">
                <h3 style="color: #0052D4; margin: 0; font-size: 16px; font-weight: 600;">Contact Details</h3>
            </div>
            
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                        <td style="padding: 10px 5px; border-bottom: 1px solid #e9ecef; color: #495057; font-weight: 600; width: 120px;">Name:</td>
                        <td style="padding: 10px 5px; border-bottom: 1px solid #e9ecef; color: #212529;">${name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 5px; border-bottom: 1px solid #e9ecef; color: #495057; font-weight: 600;">Email:</td>
                        <td style="padding: 10px 5px; border-bottom: 1px solid #e9ecef; color: #212529;">
                            <a href="mailto:${email}" style="color: #4364F7; text-decoration: none;">${email}</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 5px; border-bottom: 1px solid #e9ecef; color: #495057; font-weight: 600;">Phone:</td>
                        <td style="padding: 10px 5px; border-bottom: 1px solid #e9ecef; color: #212529;">
                            ${phone || '<span style="color: #6c757d; font-style: italic;">Not provided</span>'}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 5px; border-bottom: 1px solid #e9ecef; color: #495057; font-weight: 600; vertical-align: top;">Message:</td>
                        <td style="padding: 10px 5px; border-bottom: 1px solid #e9ecef; color: #212529;">
                            <div style="line-height: 1.5;">${message}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 5px; color: #495057; font-weight: 600;">Submitted on:</td>
                        <td style="padding: 10px 5px; color: #212529;">${new Date().toLocaleString()}</td>
                    </tr>
                </table>
            </div>
        </div>
        
        <!-- Action Buttons -->
        <div style="text-align: center; margin: 25px 0; display: flex; justify-content: center; gap: 15px;">
            <a href="mailto:${email}" style="display: inline-block; background-color: #4364F7; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: 500; font-size: 14px;">Reply to Customer</a>
        </div>
        
        <div style="background-color: #fff8e6; border-left: 4px solid #ffc107; padding: 12px 15px; border-radius: 4px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Response Time Policy:</strong> Please respond to all inquiries within 24 business hours.
            </p>
        </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-top: 1px solid #e9ecef;">
        <p style="margin: 0; color: #6c757d; font-size: 13px;">This is an automated admin notification from the Impex Info contact system.</p>
    </div>
</div>
        `;

        // Send confirmation email to user
        const userMailOptions = {
            from: {
                name: 'ImpexInfo Support',
                address: process.env.EMAIL_USER
            },
            to: email,
            replyTo: process.env.EMAIL_USER, // Add reply-to header
            subject: 'Thank you for contacting ImpexInfo',
            html: userEmailHtml,
            text: `Dear ${name}, Thank you for contacting Impex Info. We have received your message and will get back to you shortly.`, // Plain text alternative
            headers: {
                'X-Priority': '1', // Set high priority
                'Importance': 'high',
                'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
                'Precedence': 'bulk'
            }
        };

        // Send notification email to admin
        const adminMailOptions = {
            from: {
                name: 'Contact Form',
                address: process.env.EMAIL_USER
            },
            to: process.env.ADMIN_EMAIL, // Admin email from .env
            subject: `New Contact Form Submission from ${name}`,
            html: adminEmailHtml,
            text: `New contact from ${name} (${email}): ${message}` // Plain text alternative
        };

        // Send both emails
        try {
            await transporter.sendMail(userMailOptions);
            console.log('User confirmation email sent successfully');
        } catch (userEmailError) {
            console.error('Error sending user confirmation email:', userEmailError);
            // Continue execution to at least try sending the admin email
        }
        
        try {
            await transporter.sendMail(adminMailOptions);
            console.log('Admin notification email sent successfully');
        } catch (adminEmailError) {
            console.error('Error sending admin notification email:', adminEmailError);
            throw adminEmailError; // Re-throw to trigger the outer catch block
        }

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Your message has been sent successfully!'
        });

    } catch (error) {
        console.error('Email sending error:', error);
        next(error);
    }
};

// ==================== ROUTES ====================

// Blog API Routes
app.get("/api/blogs", getBlogs);
app.get("/api/blog/:id", getBlog);
app.post("/api/blog/new", createBlog);
app.put("/api/blog/:id", updateBlog);
app.delete("/api/blog/:id", deleteBlog);

// Contact API Route
app.post("/api/contact", submitContactForm);

// Test API endpoint
app.get("/test", (req, res) => {
  res.json({ message: "Test API is working!" });
});

// Add new status check endpoint
app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        status: {
            database: {
                connected: dbStatus,
                message: dbStatus ? "MongoDB is connected" : "MongoDB is disconnected"
            },
            emailServer: {
                ready: emailServerStatus,
                message: emailServerStatus ? "Email server is ready" : "Email server is not ready"
            },
            server: {
                status: "running",
                port: PORT
            }
        }
    });
});

// Root route (status page)
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>ImpexInfo API Server Status</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 20px auto;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .status-container {
                    background-color: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .status-item {
                    margin: 10px 0;
                    padding: 15px;
                    border-radius: 4px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .status-badge {
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-weight: bold;
                }
                .success {
                    background-color: #e8f5e9;
                    color: #2e7d32;
                }
                .error {
                    background-color: #ffebee;
                    color: #c62828;
                }
                h1 {
                    color: #333;
                    text-align: center;
                    margin-bottom: 30px;
                }
                .refresh-button {
                    background-color: #4364F7;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 20px;
                }
                .refresh-button:hover {
                    background-color: #2850e0;
                }
            </style>
        </head>
        <body>
            <div class="status-container">
                <h1>ImpexInfo API Server Status</h1>
                <div class="status-item ${dbStatus ? 'success' : 'error'}">
                    <span>MongoDB Connection:</span>
                    <span class="status-badge">${dbStatus ? '✅ Connected' : '❌ Disconnected'}</span>
                </div>
                <div class="status-item ${emailServerStatus ? 'success' : 'error'}">
                    <span>Email Server:</span>
                    <span class="status-badge">${emailServerStatus ? '✅ Ready' : '❌ Not Ready'}</span>
                </div>
                <div class="status-item success">
                    <span>API Server:</span>
                    <span class="status-badge">✅ Running on port ${PORT}</span>
                </div>
                <div style="text-align: center;">
                    <button class="refresh-button" onclick="window.location.reload()">
                        Refresh Status
                    </button>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Add catch-all route for undefined paths
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Page Not Found</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 20px auto;
                    padding: 20px;
                    background-color: #f5f5f5;
                    text-align: center;
                }
                .error-container {
                    background-color: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .error-code {
                    font-size: 72px;
                    color: #dc3545;
                    margin: 0;
                }
                .error-message {
                    color: #666;
                    margin: 20px 0;
                }
                .home-button {
                    background-color: #4364F7;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    text-decoration: none;
                    display: inline-block;
                    margin-top: 20px;
                }
                .home-button:hover {
                    background-color: #2850e0;
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h1 class="error-code">404</h1>
                <h2>Page Not Found</h2>
                <p class="error-message">
                    The page you're looking for doesn't exist. You might have mistyped the address or the page may have moved.
                </p>
                <p class="error-message">
                    Current URL: ${req.url}<br>
                    Try accessing the status page or API endpoints instead.
                </p>
                <a href="/" class="home-button">Go to Status Page</a>
            </div>
        </body>
        </html>
    `);
});

// Error handler middleware
app.use(errorHandler);

// Modify startServer to handle ports better
const startServer = async () => {
    console.log('🚀 Starting ImpexInfo API Server...');
    
    // Verify email server first
    console.log('📧 Verifying email server configuration...');
    await verifyEmailServer();
    
    // Then connect to database
    console.log('🔄 Connecting to MongoDB...');
    const isConnected = await ConnectDB();

    if (isConnected) {
        // Try available ports in sequence
        const tryPort = (port) => {
            app.listen(port, () => {
                console.log(`✅ Server is running on port ${port}`);
                console.log(`📊 Status dashboard available at http://localhost:${port}`);
                console.log(`🔍 API status available at http://localhost:${port}/api/status`);
            }).on("error", (err) => {
                if (err.code === "EADDRINUSE") {
                    console.error(`❌ Port ${port} is already in use.`);
                    // Try next port if less than 65535
                    if (port < 65535) {
                        tryPort(port + 1);
                    } else {
                        console.error("❌ No available ports found");
                        process.exit(1);
                    }
                } else {
                    console.error("❌ Server error:", err);
                    process.exit(1);
                }
            });
        };

        // Start with initial port
        tryPort(parseInt(PORT) || 8000);
    } else {
        console.log("⏳ Server start delayed until database connection is established.");
    }
};

startServer();
