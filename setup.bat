@echo off
echo 🚀 Setting up AI Voice Assistant...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js v16 or higher.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1,2,3 delims=." %%a in ('node --version') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% LSS 16 (
    echo ❌ Node.js version 16 or higher is required. Current version: 
    node --version
    pause
    exit /b 1
)

echo ✅ Node.js version: 
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm.
    pause
    exit /b 1
)

echo ✅ npm version: 
npm --version

REM Create necessary directories
echo 📁 Creating directories...
if not exist "backend\uploads" mkdir backend\uploads
if not exist "frontend\assets" mkdir frontend\assets

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
call npm install

REM Copy environment file
if not exist ".env" (
    echo 📝 Creating .env file from template...
    copy env.example .env
    echo ⚠️  Please edit backend\.env with your API keys before starting the server.
)

cd ..

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
call npm install

cd ..

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo 1. Edit backend\.env with your API keys:
echo    - OpenAI API key
echo    - Google OAuth credentials
echo    - MongoDB connection string
echo    - JWT secret
echo.
echo 2. Start the backend server:
echo    cd backend ^&^& npm run dev
echo.
echo 3. Start the frontend:
echo    cd frontend ^&^& npm start
echo.
echo 4. Set up Google Cloud Console:
echo    - Enable Google Calendar API
echo    - Enable Gmail API
echo    - Create OAuth 2.0 credentials
echo.
echo 📚 For detailed setup instructions, see README.md
echo.
pause
