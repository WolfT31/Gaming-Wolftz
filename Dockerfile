# Use official PHP with Apache
FROM php:8.2-apache

# Install PHP extensions (ADD ANY YOUR APP NEEDS)
RUN docker-php-ext-install pdo_mysql mysqli

# Enable Apache mod_rewrite for clean URLs
RUN a2enmod rewrite

# Copy your website files into the container
COPY . /var/www/html/

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html
