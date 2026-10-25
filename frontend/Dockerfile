FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
# Build files are not part of the public site
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/README.md /usr/share/nginx/html/.dockerignore
