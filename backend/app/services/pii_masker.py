"""PII Masking utility for protecting sensitive data before embedding generation."""
import re
from typing import Optional


class PIIMasker:
    """Masks personally identifiable information in ticket text."""

    # Regex patterns for PII detection
    EMAIL_PATTERN = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    PHONE_PATTERN = r'\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b'
    IP_PATTERN = r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b'
    EMPLOYEE_ID_PATTERN = r'\bEMP[-]?\d{6,8}\b|\bID[-]?\d{6,8}\b'
    ACCOUNT_NUMBER_PATTERN = r'\b\d{8,16}\b'  # 8-16 digit sequences
    SSN_PATTERN = r'\b\d{3}[-]?\d{2}[-]?\d{4}\b'

    @staticmethod
    def mask_email(text: str) -> str:
        """Replace email addresses with [EMAIL]."""
        return re.sub(PIIMasker.EMAIL_PATTERN, '[EMAIL]', text, flags=re.IGNORECASE)

    @staticmethod
    def mask_phone(text: str) -> str:
        """Replace phone numbers with [PHONE]."""
        return re.sub(PIIMasker.PHONE_PATTERN, '[PHONE]', text)

    @staticmethod
    def mask_ip(text: str) -> str:
        """Replace IP addresses with [IP]."""
        return re.sub(PIIMasker.IP_PATTERN, '[IP]', text)

    @staticmethod
    def mask_employee_id(text: str) -> str:
        """Replace employee IDs with [EMPLOYEE_ID]."""
        return re.sub(PIIMasker.EMPLOYEE_ID_PATTERN, '[EMPLOYEE_ID]', text, flags=re.IGNORECASE)

    @staticmethod
    def mask_ssn(text: str) -> str:
        """Replace SSNs with [SSN]."""
        return re.sub(PIIMasker.SSN_PATTERN, '[SSN]', text)

    @staticmethod
    def mask_account_number(text: str) -> str:
        """Replace account numbers (8-16 consecutive digits) with [ACCOUNT]."""
        return re.sub(PIIMasker.ACCOUNT_NUMBER_PATTERN, '[ACCOUNT]', text)

    # Technical / product / org terms that must never be replaced with [PERSON].
    # All entries must be UPPERCASE for the case-insensitive comparison below.
    _TECHNICAL_TERMS = {
        # Network / infra
        "VPN", "WIFI", "LAN", "WAN", "DNS", "DHCP", "IP", "SSL", "TLS", "SSH",
        "HTTP", "HTTPS", "API", "URL", "TCP", "UDP",
        # Enterprise apps
        "HRMS", "ERP", "CRM", "SAP", "SSO", "LDAP", "MFA", "OTP",
        "JIRA", "SLACK", "TEAMS", "ZOOM", "OUTLOOK", "SHAREPOINT",
        # IT / OS
        "OS", "CPU", "RAM", "SSD", "HDD", "USB", "BIOS", "VM", "VDI",
        "WINDOWS", "LINUX", "MACOS", "IOS", "ANDROID",
        # Common IT proper nouns that appear mid-sentence
        "GREYT", "GREYTHR", "WORKDAY", "SERVICENOW", "ZENDESK",
    }

    @staticmethod
    def mask_names(text: str) -> str:
        """
        Mask human names mid-sentence with [PERSON].
        Skips technical acronyms, product names, and org-specific terms
        so that ticket similarity search is not broken by over-masking.
        """
        words = text.split()
        masked_words = []
        for i, word in enumerate(words):
            # Preserve sentence-start words and words after period.
            if i == 0 or words[i - 1].endswith('.'):
                masked_words.append(word)
                continue

            # Only candidate if pure alpha + title-case or all-caps
            if not (word.isalpha() and len(word) > 1 and word[0].isupper()):
                masked_words.append(word)
                continue

            # Skip known technical/product terms
            if word.upper() in PIIMasker._TECHNICAL_TERMS:
                masked_words.append(word)
                continue

            masked_words.append('[PERSON]')
        return ' '.join(masked_words)

    @staticmethod
    def mask_pii(text: str) -> str:
        """
        Apply all PII masking transformations in sequence.
        Order matters: do emails/phones before general patterns.
        """
        if not text:
            return text

        # Apply masking in sequence
        masked = text
        masked = PIIMasker.mask_email(masked)
        masked = PIIMasker.mask_phone(masked)
        masked = PIIMasker.mask_ip(masked)
        masked = PIIMasker.mask_employee_id(masked)
        masked = PIIMasker.mask_ssn(masked)
        masked = PIIMasker.mask_account_number(masked)
        # mask_names is intentionally excluded: word-by-word title-case heuristics
        # cause false positives on technical terms (Password, Outlook, Unable, etc.)
        # and destroy semantic similarity. Structured PII (email, phone, employee IDs)
        # is sufficient for embedding privacy in an IT helpdesk context.

        return masked
