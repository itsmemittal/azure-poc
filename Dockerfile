# Start with Node.js base image
FROM node:18

# Install Python + pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /usr/src/app

# Copy Node dependencies and install
COPY package*.json ./
RUN npm install

# Copy Python requirements and install
COPY python/requirements.txt ./python/requirements.txt
RUN pip3 install --no-cache-dir -r python/requirements.txt

# Copy the rest of the app
COPY . .

# Create uploads directory and set permissions
RUN mkdir -p uploads && chmod 755 uploads

# Make Python scripts executable
RUN chmod +x python/*.py

# Expose port
EXPOSE 3000

# Start Node.js app
CMD ["node", "app.js"]
