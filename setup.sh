#!/bin/bash

echo "🚀 Setting up AI Voice Assistant..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p backend/uploads
mkdir -p frontend/assets

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit backend/.env with your API keys before starting the server."
fi

cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit backend/.env with your API keys:"
echo "   - OpenAI API key"
echo "   - Google OAuth credentials"
echo "   - MongoDB connection string"
echo "   - JWT secret"
echo ""
echo "2. Start the backend server:"
echo "   cd backend && npm run dev"
echo ""
echo "3. Start the frontend:"
echo "   cd frontend && npm start"
echo ""
echo "4. Set up Google Cloud Console:"
echo "   - Enable Google Calendar API"
echo "   - Enable Gmail API"
echo "   - Create OAuth 2.0 credentials"
echo ""
echo "📚 For detailed setup instructions, see README.md"
echo ""
