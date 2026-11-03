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
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Stage 2: Production Latest Patched PHP 8.3 + Nginx Web Server
FROM php:8.3-fpm-alpine

# Install Nginx, supervisor, curl and required PHP extensions
RUN apk add --no-cache nginx supervisor curl tzdata \
    && docker-php-ext-install pdo pdo_mysql bcmath sockets

WORKDIR /var/www/html

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/dist /var/www/html/public

# Copy backend PHP code
COPY backend/ /var/www/html/backend

# Configure Nginx
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Configure Supervisor to run Nginx, PHP-FPM, and Crond
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Setup cron job for OLT background sync every 2 hours
RUN echo "0 */2 * * * php /var/www/html/backend/cron/sync_olt.php >> /var/log/cron.log 2>&1" > /etc/crontabs/root

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
