import os
import smtplib
import html as html_mod
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from core.config import settings

logger = logging.getLogger("worker.services.email_service")

class EmailService:
    def __init__(self):
        pass

    def wrap_plain_text_as_html(self, text: str) -> str:
        """Converts plain text (with \\n line breaks) into a styled HTML email body.
        
        Escapes HTML special characters, replaces newlines with <br> tags,
        and wraps the result in an HTML document with Aptos/Calibri font styling.
        """
        escaped = html_mod.escape(text)
        body_html = escaped.replace("\n", "<br>")
        return f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: "Aptos", "Calibri", sans-serif; font-size: 14px; color: #000; line-height: 1.5; }}
        .divider {{ border-top: 1px dashed #ccc; margin: 15px 0; }}
        .red-star {{ color: red; font-size: 16px; }}
        .link {{ color: #0563C1; text-decoration: underline; }}
    </style>
</head>
<body>
    {body_html}
</body>
</html>'''

    def send_email(self, to_email: str, subject: str, email_body: str, cc_email: str = None) -> bool:
        """Wraps the plain-text email body as styled HTML and sends it via SMTP.
        
        The email_body parameter is the plain-text content from the frontend payload.
        Line breaks (\\n) are converted to <br> tags and wrapped in a CSS container
        with Aptos/Calibri font styling for consistent Outlook rendering.
        """
        smtp_config = settings.SMTP_CONFIG
        if not smtp_config or not smtp_config.get("host"):
            logger.warning("SMTP configuration is missing. Skipping actual email dispatch.")
            return False

        try:
            # Prepare message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = smtp_config.get("username") or "noreply@aapico.com"
            msg['To'] = to_email
            
            if cc_email:
                msg['Cc'] = cc_email

            # Convert plain text body to styled HTML
            html_body = self.wrap_plain_text_as_html(email_body)
            msg.attach(MIMEText(html_body, 'html'))

            # Combine To and Cc for actual SMTP dispatch
            recipients = [to_email]
            if cc_email:
                recipients.append(cc_email)

            # Send Email
            host = smtp_config.get("host")
            port = int(smtp_config.get("port", 25))
            
            logger.info(f"Connecting to SMTP server at {host}:{port}")
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.ehlo()
                
                # If using TLS, start it (Optional depending on gateway)
                # server.starttls()
                
                user = smtp_config.get("username")
                password = smtp_config.get("password")
                
                if user and password:
                    server.login(user, password)
                    
                server.sendmail(msg['From'], recipients, msg.as_string())
                
            logger.info(f"Successfully dispatched email to {to_email}")
            return True

        except smtplib.SMTPException as e:
            logger.error(f"SMTP error occurred: {e}")
            raise Exception(f"Failed to send email due to SMTP error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while sending email: {e}")
            raise

email_service = EmailService()
