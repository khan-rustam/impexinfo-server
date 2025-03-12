# ImpexInfo Server

<div align="center">
  <img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzM0OTI5MjQ1MzIyNzM5NjQzNjM4NzM5NjQzODczOTY0MzI3MzY0MyZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/3oKIPEqDGUULpEU0aQ/giphy.gif" alt="Server Animation" width="500"/>
</div>

## 📋 Overview

ImpexInfo Server is a robust Node.js backend application built with Express and MongoDB. It provides RESTful API endpoints for the ImpexInfo application, handling data storage, retrieval, and email notifications.

## 🚀 Features

- **RESTful API**: Well-structured endpoints for data operations
- **MongoDB Integration**: Secure and scalable database storage
- **Email Notifications**: Automated email sending capabilities
- **Environment Configuration**: Secure management of sensitive information
- **Error Handling**: Comprehensive error management

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (with Mongoose ODM)
- **Email Service**: Nodemailer
- **Development**: Nodemon for hot-reloading

## 📁 Project Structure

```
server/
├── node_modules/       # Dependencies
├── .env                # Environment variables (not in repo)
├── .env.example        # Example environment variables
├── .gitignore          # Git ignore file
├── package.json        # Project metadata and dependencies
├── package-lock.json   # Locked dependencies
├── README.md           # Project documentation
└── server.js           # Main application entry point
```

## 🔧 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/impexinfo.git
   cd impexinfo/server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration
   ```

4. Start the server:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔌 API Endpoints

The server provides the following API endpoints:

- **GET /api/...**: Fetch data
- **POST /api/...**: Create new records
- **PUT /api/...**: Update existing records
- **DELETE /api/...**: Remove records

## 📝 Environment Variables

The following environment variables are required:

| Variable | Description |
|----------|-------------|
| EMAIL_USER | Email address for sending notifications |
| EMAIL_PASS | Password for the email account |
| ADMIN_EMAIL | Administrator email for receiving alerts |
| PORT | Server port (default: 8000) |
| MONGO_URI | MongoDB connection string |

## 🧪 Testing

```bash
npm test
```

## 🔄 Development Workflow

1. Create a new branch for your feature
2. Make changes and test locally
3. Commit changes with descriptive messages
4. Push to your branch and create a pull request

## 📜 License

This project is licensed under the ISC License.

## 👥 Contributors

- Your Name - Initial work - [YourGitHub](https://github.com/yourusername)

## 🙏 Acknowledgments

- Node.js community
- Express.js team
- MongoDB team 