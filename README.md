# CipherVault

### Client-Side Secure Password Manager

CipherVault is a **browser-based password manager** designed to securely store, manage, generate, and analyze digital credentials.

The application follows a **client-side architecture** where credential processing and cryptographic operations are performed in the user's browser. Credentials are encrypted using **AES-GCM** and stored locally using **IndexedDB**.

> **Live Demo:** https://hariharan-k-2106.github.io/CipherVault/

> **GitHub Repository:** https://github.com/Hariharan-K-2106/CipherVault

---

## Features

- **Secure Vault** – Add, edit, search, reveal, copy, and delete credentials.
- **Master Password Protection** – Protect the vault with a master password.
- **AES-GCM Encryption** – Encrypt credential data before storing it locally.
- **PBKDF2 Key Derivation** – Derive the encryption key from the master password.
- **Random Salt & IV** – Generate random cryptographic values for key derivation and encryption.
- **IndexedDB Storage** – Store encrypted vault records locally in the browser.
- **Password Generator** – Generate random passwords with customizable options.
- **Password Strength Checker** – Analyze password length and character composition.
- **Password Reuse Detection** – Identify repeated passwords across credentials.
- **Security Score** – Provide an overall password-security health score.
- **Security Analysis** – Identify weak, strong, and reused passwords.
- **Auto-Lock** – Automatically lock the vault after inactivity.
- **Dark Mode** – Switch between light and dark themes.
- **Responsive UI** – Designed for desktop, tablet, and mobile screens.

---

## Security Architecture

CipherVault uses the browser's **Web Crypto API** for cryptographic operations.

### Key Derivation

The master password is processed using:

- **PBKDF2**
- **SHA-256**
- **250,000 iterations**
- **Random salt**

### Encryption

Credential data is encrypted using:

- **AES-GCM**
- **256-bit key**
- **Random 12-byte IV**

### High-Level Flow

```text
Master Password
       │
       ▼
   Random Salt
       │
       ▼
     PBKDF2
   SHA-256
       │
       ▼
  Derived Key
       │
       ▼
    AES-GCM
       │
       ▼
Encrypted Credentials
       │
       ▼
    IndexedDB
````
---

## Privacy Model

CipherVault is a **client-side web application**.

The current architecture is:

```text
User
  │
  ▼
Browser
  │
  ├── Web Crypto API
  │
  └── IndexedDB
          │
          ▼
   Encrypted Local Vault
```

This means the current application does not provide automatic cloud synchronization of the vault.

A vault stored on one computer does not automatically appear on another computer simply because the same browser account is used.

---

## Security Analysis

CipherVault provides a security-health view based on the user's stored credentials.

The dashboard tracks:

* Total passwords
* Strong passwords
* Weak passwords
* Reused passwords
* Overall security score

The current security score is a **CipherVault-specific metric** based on weak and reused passwords. It is not an industry-standard security certification.

---

## Password Generator

The password generator supports:

* Custom length
* Uppercase letters
* Lowercase letters
* Numbers
* Symbols

Random values are generated using the browser's cryptographically secure random-value API.

---

## Vault Locking

CipherVault supports:

* Manual vault locking
* Automatic locking after inactivity
* Master-password-based unlocking

When the vault is locked, active credential data and the in-memory cryptographic key are cleared from application state.

---

## Settings

The application provides settings for:

* Changing the master password
* Light / dark theme
* Auto-lock duration
* Clearing the local vault

Changing the master password re-encrypts the existing vault using a newly derived key.

---

## Technology Stack

| Technology      | Purpose                       |
| --------------- | ----------------------------- |
| HTML5           | Application structure         |
| CSS3            | Styling and responsive design |
| JavaScript ES6+ | Application logic             |
| Web Crypto API  | Cryptographic operations      |
| AES-GCM         | Credential encryption         |
| PBKDF2          | Key derivation                |
| SHA-256         | PBKDF2 hash function          |
| IndexedDB       | Local credential storage      |
| LocalStorage    | Preferences and configuration |
| Clipboard API   | Copy functionality            |
| Git             | Version control               |
| GitHub          | Source-code hosting           |
| GitHub Pages    | Deployment                    |


---

## Deployment

CipherVault is deployed using **GitHub Pages**.

### Live Application

[https://hariharan-k-2106.github.io/CipherVault/](https://hariharan-k-2106.github.io/CipherVault/)

### Repository

[https://github.com/Hariharan-K-2106/CipherVault](https://github.com/Hariharan-K-2106/CipherVault)

### Deployment Flow

```text
Local Project
     ↓
Git
     ↓
GitHub
     ↓
GitHub Pages
     ↓
Live Web Application
```

---

## Learning Outcomes

CipherVault provided practical experience in:

### Web Development

* HTML5
* CSS3
* Responsive design
* DOM manipulation
* JavaScript
* Browser APIs

### Cybersecurity

* AES-GCM encryption
* PBKDF2 key derivation
* SHA-256
* Salting
* Initialization vectors
* Secure random generation
* Password security analysis
* Session / vault locking

### Browser Technologies

* IndexedDB
* LocalStorage
* Web Crypto API
* Clipboard API

### Development Tools

* Visual Studio Code
* Git
* GitHub
* GitHub Pages
* Live Server

---

## Author

### HARIHARAN K

**GitHub:**
[https://github.com/Hariharan-K-2106](https://github.com/Hariharan-K-2106)

**Project:**
CipherVault

**Live Demo:**
[https://hariharan-k-2106.github.io/CipherVault/](https://hariharan-k-2106.github.io/CipherVault/)

---

## Project Status

**Status:** ✅ Live and deployed

**Project Type:** Client-Side Web Application

**Domain:** Web Development + Cybersecurity

**Storage:** IndexedDB

**Encryption:** AES-GCM

**Key Derivation:** PBKDF2 + SHA-256

**Backend:** None

**Deployment:** GitHub Pages

---

<p align="center">

### CipherVault

**Store Locally. Encrypt Securely. Stay in Control.**

</p>

