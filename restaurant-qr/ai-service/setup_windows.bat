@echo off
echo ============================================
echo  Setting up AI Service for Windows
echo ============================================

:: Step 1 - Check Python (force 3.11)
py -3.11 --version 2>nul
if errorlevel 1 (
    echo ERROR: Python 3.11 not found!
    echo Install Python 3.11 and try again
    pause
    exit /b 1
)

:: Step 2 - Create virtual environment
echo.
echo Creating Python virtual environment...
py -3.11 -m venv venv

:: Step 3 - Activate it
echo Activating virtual environment...
call venv\Scripts\activate.bat

:: Step 4 - Install libraries
echo.
echo Installing AI libraries (this takes 3-5 minutes)...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

:: Step 5 - Download NLTK data
echo.
echo Downloading language data for sentiment analysis...
python -c "import nltk; nltk.download('punkt'); nltk.download('averaged_perceptron_tagger'); nltk.download('brown')"
python -c "from textblob import download_corpora; download_corpora()"

:: Step 6 - Create .env
if not exist .env (
    copy .env.example .env
    echo.
    echo IMPORTANT: Open ai-service\.env and set your DB_PASSWORD
)

:: Step 7 - Run AI table migrations
echo.
echo Creating AI database tables...
python utils/migrate_ai.py

:: Step 8 - Create models/saved folder
if not exist models\saved mkdir models\saved

echo.
echo ============================================
echo  Setup complete!
echo  To start the AI service, run: start_ai.bat
echo ============================================
pause