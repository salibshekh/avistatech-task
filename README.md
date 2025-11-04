# 🗓️ Event Management API (Google Calendar Clone)

A complete **Event Management System** built using **Node.js, Express, MongoDB, Redis**, and **Google Calendar API integration**.

Users can create, update, delete, and view events — with real-time synchronization to Google Calendar (if connected), participant management, overlap prevention, caching, and JWT authentication.

---

## 🚀 Features

✅ JWT Authentication (Register / Login / Protected Routes)  
✅ CRUD for Events (Create, Read, Update, Delete)  
✅ Prevent Overlapping Events for Creator/Participants  
✅ Soft Delete (Cancel Event)  
✅ Redis Caching for `/api/events`  
✅ Google Calendar Sync (Create / Update / Delete)  
✅ Mock Email Notifications for Participants  
✅ Role-based Access Control (User / Admin)

---

## 🏗️ Tech Stack

- **Backend:** Node.js, Express.js  
- **Database:** MongoDB (Mongoose ODM)  
- **Caching:** Redis  
- **Authentication:** JWT (jsonwebtoken)  
- **OAuth2:** Google Calendar API (googleapis)  
- **Logging:** Morgan  
- **Environment Config:** dotenv  
- **Utilities:** bcrypt for password hashing

---

## 📂 Folder Structure

event-management-api/
├── server.js
├── package.json
├── .env.example
├── config/
│ ├── db.js
│ └── redis.js
├── models/
│ ├── User.js
│ └── Event.js
├── controllers/
│ ├── userController.js
│ ├── eventController.js
│ └── googleController.js
├── routes/
│ ├── users.js
│ ├── events.js
│ └── googleAuth.js
├── middleware/
│ ├── auth.js
│ └── cache.js
├── utils/
│ ├── notify.js
│ └── googleCalendar.js
└── README.md


---

## ⚙️ Installation

### 1️⃣ Clone the repository
```bash
git clone https://github.com/salibshekh/avistatech-task.git
cd avistatech-task

2️⃣ Install dependencies

npm install express mongoose dotenv bcrypt jsonwebtoken body-parser cors morgan redis googleapis
npm install --save-dev nodemon

3️⃣ Create .env file

PORT=4000
MONGO_URI=mongodb://localhost:27017/eventdb
JWT_SECRET=your_jwt_secret_here
REDIS_URL=redis://127.0.0.1:6379
TOKEN_EXPIRES_IN=7d
CACHE_TTL_SECONDS=60

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/oauth2callback
GOOGLE_DEFAULT_CALENDAR=primary

Google Calendar Setup

Go to Google Cloud Console
.

Create a new project (e.g., Event Management API).

Navigate to APIs & Services → Credentials.

Create an OAuth 2.0 Client ID:

Application type: Web Application

Authorized redirect URI:

http://localhost:4000/api/google/oauth2callback

Copy the Client ID and Client Secret into your .env.

▶️ Running the Server

Start MongoDB and Redis first.

Then run:

npm run dev

Server will run at:

http://localhost:4000
