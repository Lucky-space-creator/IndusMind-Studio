@echo off
rem GraphRAG 全栈托管启动：ollama + ai-service 8100 + 全量抽取
set PYTHON=C:\Users\LENOVO\AppData\Local\Programs\Python\Python310\python.exe
set ROOT=E:\JavaPro\IndusMind Studio_v1.0

taskkill /f /im ollama.exe 2>nul
timeout /t 3 /nobreak >nul

set OLLAMA_MODELS=E:\Ollama\models
start "" /b "E:\Ollama\Ollama\ollama.exe" serve > E:\tmp_ollama_task.log 2>&1
timeout /t 8 /nobreak >nul

cd /d "%ROOT%\code\ai-service"
start "" /b %PYTHON% -m uvicorn app.main:app --host 0.0.0.0 --port 8100 > E:\tmp_ai8100_task.log 2>&1
timeout /t 20 /nobreak >nul

%PYTHON% -u "%ROOT%\test\scripts\graphrag_extract_all.py" > E:\tmp_graphrag_task.log 2>&1