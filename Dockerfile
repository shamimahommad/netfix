# =====================================================================
# Multi-Stage Dockerfile for Coolify 1-Click Deployment
# Builds Frontend Assets & Runs Core PHP API on a Single Port (80)
# =====================================================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Latest Patched PHP 8.3 + Nginx Web Server (Immune to CVE-2024-4577)
FROM php:8.3-fpm-alpine

# Install Nginx and required PHP extensions
RUN apk add --no-cache nginx supervisor curl \
    && docker-php-ext-install pdo pdo_mysql bcmath sockets

WORKDIR /var/www/html

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/dist /var/www/html/public

# Copy backend PHP code
COPY backend/ /var/www/html/backend

# Configure Nginx
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Configure Supervisor to run both Nginx and PHP-FPM
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
