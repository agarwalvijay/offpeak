# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    software-properties-common \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml ./
COPY uv.lock ./

# Install uv for faster dependency management
RUN pip install uv

# Install Python dependencies
RUN uv pip install --system -r pyproject.toml

# Copy application code
COPY . .

# Create .streamlit directory and config
RUN mkdir -p .streamlit
COPY .streamlit/config.toml .streamlit/

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK CMD curl --fail http://localhost:8080/_stcore/health

# Run the application
CMD ["streamlit", "run", "app.py", "--server.port=8080", "--server.address=0.0.0.0"]