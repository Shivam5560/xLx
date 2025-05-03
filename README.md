# Excel Automation Tool

A modern, AI-powered Excel automation tool that allows users to perform complex data operations through a visual interface while maintaining data privacy.

## Features

- Drag and drop file upload for Excel/CSV files
- Visual workflow builder for operations
- AI-powered suggestions for data operations
- Privacy-focused design (only metadata is shared with AI)
- Support for common Excel operations:
  - Column operations (rename, delete, reorder)
  - Data operations (filter, sort, formula)
  - Table operations (merge, pivot, lookup)
  - Advanced operations (macros, scripts)

## Tech Stack

### Backend
- Python FastAPI
- Celery for task queue
- Redis for message broker
- Pandas for data manipulation
- Groq for AI inference

### Frontend
- Next.js 14
- React Flow for visual workflow
- shadcn/ui for components
- Tailwind CSS for styling

## Prerequisites

- Python 3.8+
- Node.js 18+
- Redis server
- Groq API key

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd excel-automation
```

2. Set up the backend:
```bash
cd app
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the frontend:
```bash
cd frontend
npm install
```

4. Create a `.env` file in the root directory:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
GROQ_API_KEY=your_groq_api_key
```

5. Start Redis server:
```bash
redis-server
```

6. Start the backend services:
```bash
# Terminal 1 - FastAPI server
cd app
uvicorn main:app --reload

# Terminal 2 - Celery worker
cd app
celery -A tasks worker --loglevel=info
```

7. Start the frontend:
```bash
cd frontend
npm run dev
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Upload your Excel/CSV files
3. Use the visual interface to build your workflow
4. Get AI suggestions for operations
5. Execute the workflow and download the results

## Security

- Data privacy is maintained by only sharing metadata with the AI
- Files are processed locally
- No data is stored permanently
- Secure file handling and validation

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License 