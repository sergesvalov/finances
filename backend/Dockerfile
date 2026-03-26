FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source files for the production image
COPY . .

CMD ["sh", "-c", "python migrate.py && uvicorn main:app --host 0.0.0.0 --port 7051"]
