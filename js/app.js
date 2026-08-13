/* =========================================================
   CIPHERVAULT
   Main Application JavaScript
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL STATE
   ========================================================= */

const state = {
    currentPage: "dashboard",
    darkMode: false,
    vaultLocked: false,
    cryptoKey: null,
    vaultConfig: null,

    credentials: [],

    generator: {
        length: 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true
    },

    editingId: null,
    vaultFilter: "all",

    autoLockMinutes: 5,
    autoLockTimer: null
};


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", initializeApplication);


/* =========================================================
   INITIALIZE APPLICATION
   ========================================================= */

async function initializeApplication() {

    loadTheme();

    await initializeVaultDatabase();

    setupNavigation();

    setupHeader();

    setupDashboard();

    setupPasswordStrengthChecker();

    setupPasswordGenerator();

    setupVault();

    setupModal();

    setupLockSystem();

    setupSettings();

    updateDashboard();
    updateVaultDisplay();

    generatePassword();

    navigateTo("dashboard");

    // Credentials are deliberately unavailable until the master password is verified.
    lockVault();

}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

/*
    IMPORTANT:
    This first version keeps the application simple.

    Later we will replace the storage system with:

        PBKDF2
        AES-GCM
        Web Crypto API
        IndexedDB

    Do NOT consider this version production password storage.
*/

const DB_NAME = "CipherVault";
const DB_VERSION = 1;
const CONFIG_KEY = "cipherVaultConfig";

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("credentials")) {
                db.createObjectStore("credentials", { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function initializeVaultDatabase() {
    state.db = await openDatabase();
    const stored = localStorage.getItem(CONFIG_KEY);
    state.vaultConfig = stored ? JSON.parse(stored) : null;
    // Migrate the prototype's unencrypted local data after a new secure vault is created.
    try {
        state.legacyCredentials = JSON.parse(localStorage.getItem("cipherVaultData") || "[]");
    } catch {
        state.legacyCredentials = [];
    }
}

function bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function deriveKey(password, salt) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptValue(value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(value));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, state.cryptoKey, data);
    return { iv: bytesToBase64(iv), data: bytesToBase64(encrypted) };
}

async function decryptValue(record) {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(record.iv) }, state.cryptoKey, base64ToBytes(record.data));
    return JSON.parse(new TextDecoder().decode(decrypted));
}

function databaseRequest(mode, action) {
    return new Promise((resolve, reject) => {
        const transaction = state.db.transaction("credentials", mode);
        const request = action(transaction.objectStore("credentials"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadVault() {
    const records = await databaseRequest("readonly", store => store.getAll());
    state.credentials = await Promise.all(records.map(decryptValue));
}

async function saveCredentialToDatabase(credential) {
    const encrypted = await encryptValue(credential);
    await databaseRequest("readwrite", store => store.put({ id: credential.id, ...encrypted }));
}

async function removeCredentialFromDatabase(id) {
    await databaseRequest("readwrite", store => store.delete(id));
}


/* =========================================================
   THEME
   ========================================================= */

function loadTheme() {

    const savedTheme =
        localStorage.getItem("cipherVaultTheme");

    if (savedTheme === "dark") {

        state.darkMode = true;

        document.body.classList.add(
            "dark-mode"
        );

    }

}


function toggleTheme() {

    state.darkMode =
        !state.darkMode;

    document.body.classList.toggle(
        "dark-mode",
        state.darkMode
    );

    localStorage.setItem(
        "cipherVaultTheme",
        state.darkMode
            ? "dark"
            : "light"
    );

    showToast(
        state.darkMode
            ? "Dark mode enabled"
            : "Light mode enabled"
    );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );

    navItems.forEach(item => {

        item.addEventListener(
            "click",
            () => {

                const page =
                    item.dataset.page;

                if (!page) return;

                if (page === "vault") {
                    state.vaultFilter = "all";
                }

                navigateTo(page);

            }
        );

    });

}


function navigateTo(pageName) {

    console.log("Opening page:", pageName);

    // Get all page sections
    const pages = document.querySelectorAll(".page");

    // Hide every page
    pages.forEach(page => {
        page.style.display = "none";
        page.classList.remove("active");
    });

    // Remove active state from navigation
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach(item => {
        item.classList.remove("active");
    });

    // Find the selected page
    const targetPage = document.getElementById(pageName);

    if (!targetPage) {
        console.error(
            "Page not found:",
            pageName
        );

        return;
    }

    // Show selected page
    targetPage.style.display = "block";
    targetPage.classList.add("active");

    // Highlight selected navigation item
    const activeNav = document.querySelector(
        `.nav-item[data-page="${pageName}"]`
    );

    if (activeNav) {
        activeNav.classList.add("active");
    }

    // Update header
    state.currentPage = pageName;

    updateHeaderTitle(pageName);

    if (pageName === "security" && !state.vaultLocked) {
        updateAnalysis();
    }

    closeMobileSidebar();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function updateHeaderTitle(pageName) {

    const title =
        document.querySelector(
            "#pageTitle"
        );

    const breadcrumb =
        document.querySelector(
            "#breadcrumb"
        );

    const pageTitles = {

        dashboard: {
            title: "Security Dashboard",
            breadcrumb: "SECURITY CENTER"
        },

        strength: {
            title: "Password Strength",
            breadcrumb: "SECURITY TOOLS"
        },

        generator: {
            title: "Password Generator",
            breadcrumb: "SECURITY TOOLS"
        },

        vault: {
            title: "Secure Vault",
            breadcrumb: "PASSWORD VAULT"
        },

        security: {
            title: "Security Analysis",
            breadcrumb: "SECURITY CENTER"
        },

        settings: {
            title: "Settings",
            breadcrumb: "CIPHERVAULT SETTINGS"
        }

    };

    const data =
        pageTitles[pageName] ||
        pageTitles.dashboard;

    if (title) {

        title.textContent =
            data.title;

    }

    if (breadcrumb) {

        breadcrumb.textContent =
            data.breadcrumb;

    }

}


/* =========================================================
   HEADER
   ========================================================= */

function setupHeader() {

    const themeButton =
        document.querySelector(
            "#themeToggle"
        );

    if (themeButton) {

        themeButton.addEventListener(
            "click",
            toggleTheme
        );

    }


    const menuButton =
        document.querySelector(
            "#mobileMenuBtn"
        );

    if (menuButton) {

        menuButton.addEventListener(
            "click",
            toggleMobileSidebar
        );

    }


    const searchButton =
        document.querySelector(
            "#searchBtn"
        );

    if (searchButton) {

        searchButton.addEventListener(
            "click",
            () => {

                state.vaultFilter = "all";
                navigateTo("vault");

                setTimeout(() => {

                    const searchInput =
                        document.querySelector(
                            "#vaultSearch"
                        );

                    if (searchInput) {

                        searchInput.focus();

                    }

                }, 100);

            }
        );

    }

    const notificationButton = document.querySelector("#notificationBtn");

    if (notificationButton) {
        notificationButton.addEventListener("click", () => {
            const weak = state.credentials.filter(item => getPasswordScore(item.password) < 60).length;
            showToast(weak ? `${weak} weak password${weak === 1 ? "" : "s"} need attention` : "No new security notifications");
        });
    }

}


function toggleMobileSidebar() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );

    if (!sidebar) return;

    sidebar.classList.toggle(
        "mobile-open"
    );

}


function closeMobileSidebar() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );

    if (!sidebar) return;

    sidebar.classList.remove(
        "mobile-open"
    );

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function setupDashboard() {

    document.querySelectorAll("[data-stat-action]").forEach(card => {
        card.addEventListener("click", () => {
            const action = card.dataset.statAction;
            if (action === "vault") {
                state.vaultFilter = "all";
                navigateTo("vault");
                updateVaultDisplay(document.querySelector("#vaultSearch")?.value || "");
                document.querySelector("#vaultSearch")?.focus();
                return;
            }

            navigateTo("security");
            updateAnalysis();
            const issue = document.querySelector(`[data-issue-filter="${action}"]`);
            if (issue) {
                issue.classList.add("expanded");
                issue.setAttribute("aria-expanded", "true");
                issue.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
    });

    document.querySelectorAll("[data-page-link]").forEach(button => {
        button.addEventListener("click", () => {
            const page = button.dataset.pageLink;
            if (page === "vault") state.vaultFilter = "all";
            navigateTo(page);
            if (page === "security") updateAnalysis();
        });
    });

    ["#dashboardAddBtn", "#alertAddBtn", "#emptyVaultAddBtn"].forEach(selector => {
        document.querySelector(selector)?.addEventListener("click", () => {
            navigateTo("vault");
            openCredentialModal();
        });
    });

    const quickButtons =
        document.querySelectorAll(
            "[data-action]"
        );

    quickButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const action =
                    button.dataset.action;

                handleAction(action);

            }
        );

    });

}


function handleAction(action) {

    switch (action) {

        case "strength":
            navigateTo("strength");
            break;

        case "generator":
            navigateTo("generator");
            break;

        case "vault":
            navigateTo("vault");
            break;

        case "add-password":
            navigateTo("vault");
            openCredentialModal();
            break;

        case "analysis":
            navigateTo("analysis");
            updateAnalysis();
            break;

        default:
            break;

    }

}


function updateDashboard() {

    const total =
        state.credentials.length;

    const weak =
        state.credentials.filter(
            item =>
                getPasswordScore(
                    item.password
                ) < 60
        ).length;

    const strong =
        total - weak;

    const reused =
        countReusedPasswords();

    setText(
        "#totalPasswords",
        total
    );

    setText(
        "#weakPasswords",
        weak
    );

    setText(
        "#strongPasswords",
        strong
    );

    setText(
        "#reusedPasswords",
        reused
    );

    updateSecurityScore();

}


/* =========================================================
   SECURITY SCORE
   ========================================================= */

function calculateSecurityScore() {

    const total =
        state.credentials.length;

    if (total === 0) {

        return 100;

    }

    const weak =
        state.credentials.filter(
            item =>
                getPasswordScore(
                    item.password
                ) < 60
        ).length;

    const reused =
        countReusedPasswords();

    let score = 100;

    score -=
        (weak / total) * 40;

    score -=
        (reused / total) * 30;

    return Math.max(
        0,
        Math.round(score)
    );

}


function updateSecurityScore() {

    const score =
        calculateSecurityScore();

    setText(
        "#securityScore",
        score
    );

    setText(
        "#analysisScore",
        score
    );

    const progress =
        document.querySelector(
            ".score-progress"
        );

    if (progress) {

        const circumference =
            427.3;

        const offset =
            circumference -
            (score / 100) *
            circumference;

        progress.style.strokeDashoffset =
            offset;

    }

    const badge =
        document.querySelector(
            "#securityBadge"
        );

    if (badge) {

        if (score >= 80) {

            badge.textContent =
                "Excellent";

        } else if (score >= 60) {

            badge.textContent =
                "Good";

        } else {

            badge.textContent =
                "Needs Attention";

        }

    }

}


/* =========================================================
   PASSWORD STRENGTH CHECKER
   ========================================================= */

function setupPasswordStrengthChecker() {

    const input = document.querySelector("#strengthPassword");

    if (!input) return;

    input.addEventListener("input", () => {
        analyzePassword(input.value);
    });


    const toggle = document.querySelector(
        "#strengthPasswordToggle"
    );

    if (toggle) {

        toggle.addEventListener("click", () => {

            togglePasswordVisibility(
                input,
                toggle
            );

        });

    }


    // Analyze initial value
    analyzePassword(input.value);
}


/* =========================================================
   ANALYZE PASSWORD
   ========================================================= */

function analyzePassword(password) {

    const score = getPasswordScore(password);

    const levelElement =
        document.querySelector("#strengthLevel");

    const scoreElement =
        document.querySelector("#strengthScore");

    const progress =
        document.querySelector("#strengthProgressBar");


    // Score
    if (scoreElement) {
        scoreElement.textContent = score;
    }


    // Strength level
    let level = "Very Weak";

    if (score >= 90) {
        level = "Very Strong";
    }
    else if (score >= 75) {
        level = "Strong";
    }
    else if (score >= 50) {
        level = "Medium";
    }
    else if (score >= 25) {
        level = "Weak";
    }


    if (levelElement) {
        levelElement.textContent = level;

        levelElement.classList.remove(
            "very-weak",
            "weak",
            "medium",
            "strong",
            "very-strong"
        );

        levelElement.classList.add(
            level.toLowerCase().replace(" ", "-")
        );
    }


    // Progress bar
    if (progress) {

        progress.style.width = `${score}%`;

    }


    updateRequirements(password);

    updateSuggestions(
        password,
        score
    );

}


/* =========================================================
   PASSWORD SCORE
   ========================================================= */

function getPasswordScore(password) {

    if (!password) {
        return 0;
    }


    let score = 0;


    // Length
    if (password.length >= 8) {
        score += 20;
    }

    if (password.length >= 12) {
        score += 15;
    }

    if (password.length >= 16) {
        score += 10;
    }


    // Lowercase
    if (/[a-z]/.test(password)) {
        score += 15;
    }


    // Uppercase
    if (/[A-Z]/.test(password)) {
        score += 15;
    }


    // Number
    if (/[0-9]/.test(password)) {
        score += 12;
    }


    // Symbol
    if (/[^A-Za-z0-9]/.test(password)) {
        score += 13;
    }


    return Math.min(
        score,
        100
    );
}


/* =========================================================
   REQUIREMENTS
   ========================================================= */

function updateRequirements(password) {

    const requirements = {

        length:
            password.length >= 8,

        uppercase:
            /[A-Z]/.test(password),

        lowercase:
            /[a-z]/.test(password),

        number:
            /[0-9]/.test(password),

        symbol:
            /[^A-Za-z0-9]/.test(password)

    };


    Object.entries(requirements).forEach(
        ([name, passed]) => {

            const item =
                document.querySelector(
                    `[data-requirement="${name}"]`
                );

            if (!item) return;


            item.classList.toggle(
                "passed",
                passed
            );


            const icon =
                item.querySelector("span");


            if (icon) {

                icon.textContent =
                    passed ? "✓" : "×";

            }

        }
    );

}


/* =========================================================
   SECURITY SUGGESTIONS
   ========================================================= */

function updateSuggestions(
    password,
    score
) {

    const suggestion =
        document.querySelector(
            "#strengthSuggestion"
        );

    if (!suggestion) return;


    if (!password) {

        suggestion.textContent =
            "Enter a password to analyze its security.";

        return;
    }


    if (score >= 90) {

        suggestion.textContent =
            "Excellent! This is a very strong password. Keep it unique and never reuse it.";

    }
    else if (score >= 75) {

        suggestion.textContent =
            "Strong password. Consider adding a few more characters for maximum security.";

    }
    else if (score >= 50) {

        suggestion.textContent =
            "Good start. Increase the length and add a combination of uppercase, numbers and symbols.";

    }
    else if (score >= 25) {

        suggestion.textContent =
            "This password is weak. Make it longer and include uppercase letters, numbers and symbols.";

    }
    else {

        suggestion.textContent =
            "Very weak password. Use at least 12 characters with uppercase, lowercase, numbers and symbols.";

    }

}


/* =========================================================
   PASSWORD VISIBILITY
   ========================================================= */

const EYE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.2 3.8M6.2 6.8C3.5 8.6 2 12 2 12s3.5 6 10 6a10.5 10.5 0 0 0 3-.4"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';

function setVisibilityIcon(button, visible) {
    if (!button) return;
    button.innerHTML = visible ? EYE_OFF_ICON : EYE_ICON;
    button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
}

function togglePasswordVisibility(
    input,
    button
) {

    if (!input) return;

    if (input.type === "password") {

        input.type = "text";

        if (button) {

            setVisibilityIcon(button, true);

        }

    } else {

        input.type = "password";

        if (button) {

            setVisibilityIcon(button, false);

        }

    }

}


/* =========================================================
   PASSWORD GENERATOR
   ========================================================= */

function setupPasswordGenerator() {

    const lengthInput =
        document.querySelector(
            "#passwordLength"
        );

    const lengthValue =
        document.querySelector(
            "#passwordLengthValue"
        );

    if (lengthInput) {

        state.generator.length = Number(lengthInput.value);
        if (lengthValue) lengthValue.textContent = state.generator.length;

        lengthInput.addEventListener(
            "input",
            () => {

                state.generator.length =
                    Number(
                        lengthInput.value
                    );

                if (lengthValue) {

                    lengthValue.textContent =
                        state.generator.length;

                }

                generatePassword();

            }
        );

    }


    const options = {

        uppercase:
            "#includeUppercase",

        lowercase:
            "#includeLowercase",

        numbers:
            "#includeNumbers",

        symbols:
            "#includeSymbols"

    };


    Object.entries(
        options
    ).forEach(
        ([key, selector]) => {

            const checkbox =
                document.querySelector(
                    selector
                );

            if (!checkbox) return;

            checkbox.addEventListener(
                "change",
                () => {

                    state.generator[key] =
                        checkbox.checked;

                    generatePassword();

                }
            );

        }
    );


    const generateButton =
        document.querySelector(
            "#generatePasswordBtn"
        );

    if (generateButton) {

        generateButton.addEventListener(
            "click",
            generatePassword
        );

    }


    const copyButton =
        document.querySelector(
            "#copyGeneratedBtn"
        );

    if (copyButton) {

        copyButton.addEventListener(
            "click",
            async () => {

                const password =
                    document.querySelector(
                        "#generatedPassword"
                    )?.textContent;

                if (!password) return;

                await copyToClipboard(
                    password
                );

                showToast(
                    "Password copied"
                );

            }
        );

    }

}


function generatePassword() {

    const {
        length,
        uppercase,
        lowercase,
        numbers,
        symbols
    } = state.generator;

    let characters = "";

    if (uppercase) {

        characters +=
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    }

    if (lowercase) {

        characters +=
            "abcdefghijklmnopqrstuvwxyz";

    }

    if (numbers) {

        characters +=
            "0123456789";

    }

    if (symbols) {

        characters +=
            "!@#$%^&*()_+-=[]{}|;:,.<>?";

    }

    if (!characters) {

        characters =
            "abcdefghijklmnopqrstuvwxyz";

    }

    let password = "";

    const array =
        new Uint32Array(
            length
        );

    crypto.getRandomValues(
        array
    );

    for (
        let i = 0;
        i < length;
        i++
    ) {

        password +=
            characters[
                array[i] %
                characters.length
            ];

    }

    const output =
        document.querySelector(
            "#generatedPassword"
        );

    if (output) {

        output.textContent =
            password;

    }

}


/* =========================================================
   VAULT
   ========================================================= */

function setupVault() {

    const addButton =
        document.querySelector(
            "#addCredentialBtn"
        );

    if (addButton) {

        addButton.addEventListener(
            "click",
            openCredentialModal
        );

    }


    const searchInput =
        document.querySelector(
            "#vaultSearch"
        );

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                updateVaultDisplay(
                    searchInput.value
                );

            }
        );

    }

}


function updateVaultDisplay(
    searchTerm = ""
) {

    const container =
        document.querySelector(
            "#credentialsGrid"
        );

    if (!container) return;

    const search =
        searchTerm
            .trim()
            .toLowerCase();

    const passwordCounts = {};
    state.credentials.forEach(credential => {
        passwordCounts[credential.password] = (passwordCounts[credential.password] || 0) + 1;
    });

    const filtered =
        state.credentials.filter(
            credential => {

                const matchesFilter = state.vaultFilter === "all"
                    || (state.vaultFilter === "strong" && getPasswordScore(credential.password) >= 60)
                    || (state.vaultFilter === "weak" && getPasswordScore(credential.password) < 60)
                    || (state.vaultFilter === "reused" && passwordCounts[credential.password] > 1);

                if (!matchesFilter) return false;

                return (

                    credential.site
                        .toLowerCase()
                        .includes(search)

                    ||

                    credential.username
                        .toLowerCase()
                        .includes(search)

                );

            }
        );


    if (filtered.length === 0) {

        container.innerHTML = `

            <div class="empty-vault">

                <div class="empty-vault-icon">
                    🔐
                </div>

                <h3>
                    ${
                        search
                            ? "No credentials found"
                            : state.vaultFilter !== "all" ? "No matching credentials" : "Your vault is empty"
                    }
                </h3>

                <p>
                    ${
                        search
                            ? "Try a different search term."
                            : state.vaultFilter !== "all" ? "No credentials match this password category." : "Add your first credential to start securing your accounts."
                    }
                </p>

                ${
                    search
                        ? ""
                        : `
                            <button
                                class="primary-btn"
                                id="emptyAddCredential"
                            >
                                + Add Credential
                            </button>
                        `
                }

            </div>

        `;

        const emptyButton =
            document.querySelector(
                "#emptyAddCredential"
            );

        if (emptyButton) {

            emptyButton.addEventListener(
                "click",
                openCredentialModal
            );

        }

        return;

    }


    container.innerHTML =
        filtered
            .map(
                createCredentialCard
            )
            .join("");


    setupCredentialActions();

}


function createCredentialCard(
    credential
) {

    const maskedPassword =
        "•".repeat(
            Math.min(
                credential.password.length,
                16
            )
        );

    return `

        <article
            class="credential-card"
            data-id="${credential.id}"
        >

            <div class="credential-top">

                <div class="credential-site">

                    <div class="site-icon">
                        🔐
                    </div>

                    <div>
                        <strong>
                            ${escapeHTML(
                                credential.site
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                credential.username
                            )}
                        </span>
                    </div>

                </div>


                <div class="credential-actions">

                    <button
                        type="button"
                        data-action="reveal"
                        title="Show or hide password"
                    >
                        👁
                    </button>

                    <button
                        type="button"
                        data-action="copy"
                        title="Copy password"
                    >
                        📋
                    </button>

                    <button
                        type="button"
                        data-action="edit"
                        title="Edit"
                    >
                        ✏️
                    </button>

                    <button
                        type="button"
                        data-action="delete"
                        title="Delete"
                    >
                        🗑️
                    </button>

                </div>

            </div>


            <div class="credential-details">

                <div class="credential-row">

                    <span>
                        Username
                    </span>

                    <strong>
                        ${escapeHTML(
                            credential.username
                        )}
                    </strong>

                </div>


                <div class="credential-row">

                    <span>
                        Password
                    </span>

                    <strong
                        class="vault-password"
                        data-password="${escapeHTML(
                            credential.password
                        )}"
                    >
                        ${maskedPassword}
                    </strong>

                </div>

            </div>

        </article>

    `;

}


function setupCredentialActions() {

    const buttons =
        document.querySelectorAll(
            ".credential-actions button"
        );

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            async () => {

                const card =
                    button.closest(
                        ".credential-card"
                    );

                if (!card) return;

                const id =
                    card.dataset.id;

                const credential =
                    state.credentials.find(
                        item =>
                            String(item.id) ===
                            String(id)
                    );

                if (!credential) return;

                const action =
                    button.dataset.action;


                if (action === "copy") {

                    await copyToClipboard(
                        credential.password
                    );

                    showToast(
                        "Password copied"
                    );

                }

                if (action === "reveal") {
                    const password = card.querySelector(".vault-password");
                    const visible = password.dataset.visible === "true";
                    password.dataset.visible = String(!visible);
                    password.textContent = visible ? "•".repeat(Math.min(credential.password.length, 16)) : credential.password;
                    button.textContent = visible ? "👁" : "🙈";
                }


                if (action === "edit") {

                    openCredentialModal(
                        credential
                    );

                }


                if (action === "delete") {

                    deleteCredential(
                        credential.id
                    );

                }

            }
        );

    });

}


/* =========================================================
   MODAL
   ========================================================= */

function setupModal() {

    const closeButton =
        document.querySelector(
            "#modalCloseBtn"
        );

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeCredentialModal
        );

    }


    const cancelButton =
        document.querySelector(
            "#cancelModalBtn"
        );

    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeCredentialModal
        );

    }


    const overlay =
        document.querySelector(
            "#credentialModal"
        );

    if (overlay) {

        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    overlay
                ) {

                    closeCredentialModal();

                }

            }
        );

    }


    const form =
        document.querySelector(
            "#credentialForm"
        );

    if (form) {

        form.addEventListener(
            "submit",
            saveCredential
        );

    }


    const generateVaultPassword =
        document.querySelector(
            "#generateVaultPassword"
        );

    if (generateVaultPassword) {

        generateVaultPassword.addEventListener(
            "click",
            () => {

                const password =
                    generateSecurePassword(
                        18
                    );

                const input =
                    document.querySelector(
                        "#credentialPassword"
                    );

                if (input) {

                    input.value =
                        password;

                }

            }
        );

    }


    const showPassword =
        document.querySelector(
            "#credentialPasswordToggle"
        );

    if (showPassword) {

        showPassword.addEventListener(
            "click",
            () => {

                const input =
                    document.querySelector(
                        "#credentialPassword"
                    );

                togglePasswordVisibility(
                    input,
                    showPassword
                );

            }
        );

    }

}


function openCredentialModal(
    credential = null
) {

    const modal =
        document.querySelector(
            "#credentialModal"
        );

    if (!modal) return;

    state.editingId =
        credential
            ? credential.id
            : null;

    const title =
        document.querySelector(
            "#credentialModalTitle"
        );

    if (title) {

        title.textContent =
            credential
                ? "Edit Credential"
                : "Add Credential";

    }


    setInputValue(
        "#credentialWebsite",
        credential?.site || ""
    );

    setInputValue(
        "#credentialUsername",
        credential?.username || ""
    );

    setInputValue(
        "#credentialPassword",
        credential?.password || ""
    );


    modal.classList.add(
        "show"
    );


    setTimeout(
        () => {

            document
                .querySelector(
                    "#credentialWebsite"
                )
                ?.focus();

        },
        100
    );

}


function closeCredentialModal() {

    const modal =
        document.querySelector(
            "#credentialModal"
        );

    if (!modal) return;

    modal.classList.remove(
        "show"
    );

    state.editingId =
        null;

    const form =
        document.querySelector(
            "#credentialForm"
        );

    if (form) {

        form.reset();

    }

}


async function saveCredential(
    event
) {

    event.preventDefault();

    const site =
        getInputValue(
            "#credentialWebsite"
        ).trim();

    const username =
        getInputValue(
            "#credentialUsername"
        ).trim();

    const password =
        getInputValue(
            "#credentialPassword"
        );


    if (
        !site ||
        !username ||
        !password
    ) {

        showToast(
            "Please fill all fields"
        );

        return;

    }


    if (state.editingId) {

        const credential =
            state.credentials.find(
                item =>
                    item.id ===
                    state.editingId
            );

        if (credential) {

            credential.site =
                site;

            credential.username =
                username;

            credential.password =
                password;

            credential.updatedAt =
                new Date().toISOString();

        }

        showToast(
            "Credential updated"
        );

    } else {

        state.credentials.push({

            id:
                Date.now(),

            site,

            username,

            password,

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()

        });

        showToast(
            "Credential added"
        );

    }


    try {
        const saved = state.credentials.find(item => item.id === (state.editingId || state.credentials[state.credentials.length - 1].id));
        await saveCredentialToDatabase(saved);
    } catch (error) {
        console.error("Unable to save credential:", error);
        showToast("Could not save credential");
        return;
    }

    closeCredentialModal();

    updateVaultDisplay();

    updateDashboard();

    updateAnalysis();

}


async function deleteCredential(
    id
) {

    const confirmed =
        confirm(
            "Delete this credential?"
        );

    if (!confirmed) return;

    state.credentials =
        state.credentials.filter(
            item =>
                item.id !== id
        );

    await removeCredentialFromDatabase(id);

    updateVaultDisplay();

    updateDashboard();

    updateAnalysis();

    showToast(
        "Credential deleted"
    );

}


/* =========================================================
   ANALYSIS
   ========================================================= */

function updateAnalysis() {

    const score =
        calculateSecurityScore();

    setText(
        "#analysisScore",
        score
    );

    const weak =
        state.credentials.filter(
            item =>
                getPasswordScore(
                    item.password
                ) < 60
        ).length;

    const reused =
        countReusedPasswords();

    const strong = state.credentials.filter(item => getPasswordScore(item.password) >= 60).length;


    setText(
        "#analysisWeak",
        weak
    );

    setText("#analysisStrong", strong);

    setText(
        "#analysisReused",
        reused
    );

    setText(
        "#analysisTotal",
        state.credentials.length
    );

    const issues = document.querySelector("#securityIssues");
    if (issues) {
        const weakItems = state.credentials.filter(item => getPasswordScore(item.password) < 60);
        const strongItems = state.credentials.filter(item => getPasswordScore(item.password) >= 60);
        const counts = {};
        state.credentials.forEach(item => counts[item.password] = (counts[item.password] || 0) + 1);
        const reusedItems = state.credentials.filter(item => counts[item.password] > 1);
        const names = items => items.map(item => escapeHTML(item.site || item.username || "Unnamed credential")).join(", ");
        const warnings = [];
        if (!state.credentials.length) warnings.push(["No credentials yet", "Add credentials to receive a detailed security analysis."]);
        if (weak) warnings.push([`${weak} weak password${weak === 1 ? "" : "s"}`, "Replace weak passwords with longer, unique passwords."]);
        if (reused) warnings.push([`${reused} reused password${reused === 1 ? "" : "s"}`, "Use a different password for every account."]);
        issues.innerHTML = warnings.length ? warnings.map(([title, description]) => `<div class="issue-item"><div class="issue-icon warning">!</div><div><strong>${title}</strong><p>${description}</p></div></div>`).join("") : '<div class="issue-item"><div class="issue-icon success">✓</div><div><strong>No security issues found</strong><p>Your saved passwords look healthy.</p></div></div>';
        const issueRows = [];
        if (weakItems.length) issueRows.push(["weak", `${weakItems.length} weak passwords`, names(weakItems), "Replace weak passwords with longer, unique passwords."]);
        if (strongItems.length) issueRows.push(["strong", `${strongItems.length} strong passwords`, names(strongItems), "Click to view these credentials."]);
        if (reusedItems.length) issueRows.push(["reused", `${reusedItems.length} reused passwords`, names(reusedItems), "Click to view credentials sharing passwords."]);
        if (issueRows.length) issues.innerHTML = issueRows.map(([filter, title, credentials, description]) => `<button class="issue-item issue-action" type="button" data-issue-filter="${filter}" aria-expanded="false"><div class="issue-icon warning">!</div><div><strong>${title}</strong><p class="issue-credential-names">${credentials}</p><small>${description}</small></div></button>`).join("");
        issues.querySelectorAll("[data-issue-filter]").forEach(issue => issue.addEventListener("click", () => {
            const expanded = issue.classList.toggle("expanded");
            issue.setAttribute("aria-expanded", String(expanded));
        }));
    }

}


function countReusedPasswords() {

    const counts =
        {};

    state.credentials.forEach(
        credential => {

            const password =
                credential.password;

            counts[password] =
                (counts[password] || 0) + 1;

        }
    );


    let reused = 0;

    state.credentials.forEach(
        credential => {

            if (
                counts[
                    credential.password
                ] > 1
            ) {

                reused++;

            }

        }
    );

    return reused;

}


/* =========================================================
   LOCK SYSTEM
   ========================================================= */

function setupLockSystem() {

    document.querySelector("#toggleCreatedMasterPassword")?.addEventListener("click", () => {
        const input = document.querySelector("#createdMasterPassword");
        if (input) input.type = input.type === "password" ? "text" : "password";
    });

    const lockButton =
        document.querySelector(
            "#lockVaultBtn"
        );

    if (lockButton) {

        lockButton.addEventListener(
            "click",
            lockVault
        );

    }


    const unlockButton =
        document.querySelector(
            "#unlockVaultBtn"
        );

    if (unlockButton) {

        unlockButton.addEventListener(
            "click",
            unlockVault
        );

    }


    const lockPassword =
        document.querySelector(
            "#unlockPassword"
        );

    if (lockPassword) {

        lockPassword.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    unlockVault();

                }

            }
        );

    }

    document.querySelectorAll(".password-toggle").forEach(button => {
        setVisibilityIcon(button, false);
        button.addEventListener("click", () => {
            const input = document.querySelector(`#${button.dataset.target}`);
            togglePasswordVisibility(input, button);
        });
    });


    resetAutoLockTimer();

    document.addEventListener(
        "mousemove",
        resetAutoLockTimer
    );

    document.addEventListener(
        "keydown",
        resetAutoLockTimer
    );

    document.addEventListener(
        "click",
        resetAutoLockTimer
    );

}


function lockVault() {

    state.vaultLocked =
        true;

    const lockScreen =
        document.querySelector(
            "#lockScreen"
        );

    if (lockScreen) {

        lockScreen.classList.add(
            "show"
        );

    }

    const input =
        document.querySelector(
            "#unlockPassword"
        );

    if (input) {

        input.value = "";

    }

    state.cryptoKey = null;
    state.credentials = [];
    updateVaultDisplay();
    updateDashboard();

    const isSetup = !state.vaultConfig;
    setText("#lockTitle", isSetup ? "Create your master password" : "Vault Locked");
    setText("#lockDescription", isSetup ? "Create a strong master password. It encrypts your vault and cannot be recovered." : "Enter your master password to unlock your secure vault.");
    if (input) {
        input.placeholder = isSetup ? "Create master password" : "Master password";
        input.autocomplete = isSetup ? "new-password" : "current-password";
    }
    const confirmWrapper = document.querySelector("#confirmPasswordWrapper");
    if (confirmWrapper) confirmWrapper.hidden = !isSetup;
    const warning = document.querySelector("#masterPasswordWarning");
    if (warning) warning.hidden = !isSetup;

}


async function unlockVault() {

    const input =
        document.querySelector(
            "#unlockPassword"
        );

    const error =
        document.querySelector(
            "#lockError"
        );

    const password =
        input?.value || "";


    if (!password) {
        if (error) error.textContent = "Enter your master password.";
        return;
    }

    try {
        if (!state.vaultConfig) {
            const confirmation = getInputValue("#confirmMasterPassword");
            if (password.length < 12) throw new Error("Use at least 12 characters for your master password.");
            if (password !== confirmation) throw new Error("Master passwords do not match.");
            const salt = crypto.getRandomValues(new Uint8Array(16));
            state.cryptoKey = await deriveKey(password, salt);
            const verifier = await encryptValue({ verified: true });
            state.vaultConfig = { salt: bytesToBase64(salt), verifier };
            localStorage.setItem(CONFIG_KEY, JSON.stringify(state.vaultConfig));
            for (const credential of state.legacyCredentials || []) {
                await saveCredentialToDatabase(credential);
            }
            localStorage.removeItem("cipherVaultData");
            localStorage.removeItem("cipherVaultMaster");
            showMasterPasswordCreated(password);
        } else {
            state.cryptoKey = await deriveKey(password, base64ToBytes(state.vaultConfig.salt));
            await decryptValue(state.vaultConfig.verifier);
        }

        await loadVault();
        state.vaultLocked = false;
        if (error) error.textContent = "";
        hideLockScreen();
        updateVaultDisplay();
        updateDashboard();
        updateAnalysis();
        resetAutoLockTimer();
        showToast("Vault unlocked");
    } catch (unlockError) {

        if (error) {

            error.textContent = unlockError.message || "Incorrect master password.";

        }

        if (input) {

            input.value = "";

            input.focus();

        }

        state.cryptoKey = null;
    }

}

function showMasterPasswordCreated(password) {
    const modal = document.querySelector("#masterPasswordCreatedModal");
    const input = document.querySelector("#createdMasterPassword");
    if (!modal || !input) return;
    input.value = password;
    modal.classList.add("show");
    document.querySelector("#copyCreatedMasterPassword")?.addEventListener("click", async () => {
        await copyToClipboard(password);
        showToast("Master password copied");
    }, { once: true });
    document.querySelector("#downloadCreatedMasterPassword")?.addEventListener("click", () => {
        const blob = new Blob([`CipherVault master password\\n\\n${password}\\n`], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "CipherVault-master-password.txt";
        link.click();
        URL.revokeObjectURL(link.href);
        showToast("Password downloaded");
    }, { once: true });
    document.querySelector("#doneCreatedMasterPassword")?.addEventListener("click", () => modal.classList.remove("show"), { once: true });
}


function hideLockScreen() {

    const lockScreen =
        document.querySelector(
            "#lockScreen"
        );

    if (lockScreen) {

        lockScreen.classList.remove(
            "show"
        );

    }

}


function resetAutoLockTimer() {

    if (state.vaultLocked) {

        return;

    }

    clearTimeout(
        state.autoLockTimer
    );

    state.autoLockTimer =
        setTimeout(
            () => {

                if (
                    state.credentials.length >
                    0
                ) {

                    lockVault();

                }

            },
            state.autoLockMinutes *
            60 *
            1000
        );

}


/* =========================================================
   SETTINGS
   ========================================================= */

function setupSettings() {

    const changeButton = document.querySelector("#changeMasterPasswordBtn");
    const passwordModal = document.querySelector("#masterPasswordModal");
    const closePasswordModal = () => passwordModal?.classList.remove("show");
    changeButton?.addEventListener("click", () => {
        if (state.vaultLocked || !state.cryptoKey) {
            showToast("Unlock the vault before changing your password");
            return;
        }
        passwordModal?.classList.add("show");
        document.querySelector("#currentMasterPassword")?.focus();
    });
    document.querySelector("#closeMasterPasswordModal")?.addEventListener("click", closePasswordModal);
    document.querySelector("#cancelMasterPassword")?.addEventListener("click", closePasswordModal);
    document.querySelector("#masterPasswordForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        const error = document.querySelector("#masterPasswordError");
        const current = getInputValue("#currentMasterPassword");
        const next = getInputValue("#newMasterPassword");
        const confirmation = getInputValue("#confirmNewMasterPassword");
        const oldKey = state.cryptoKey;
        try {
            if (next.length < 12) throw new Error("Use at least 12 characters for the new password.");
            if (next !== confirmation) throw new Error("New passwords do not match.");
            const records = await databaseRequest("readonly", store => store.getAll());
            state.cryptoKey = await deriveKey(current, base64ToBytes(state.vaultConfig.salt));
            await decryptValue(state.vaultConfig.verifier);
            const credentials = await Promise.all(records.map(decryptValue));
            const salt = crypto.getRandomValues(new Uint8Array(16));
            state.cryptoKey = await deriveKey(next, salt);
            const verifier = await encryptValue({ verified: true });
            state.vaultConfig = { ...state.vaultConfig, salt: bytesToBase64(salt), verifier };
            localStorage.setItem(CONFIG_KEY, JSON.stringify(state.vaultConfig));
            await databaseRequest("readwrite", store => store.clear());
            for (const credential of credentials) await saveCredentialToDatabase(credential);
            closePasswordModal();
            document.querySelector("#masterPasswordForm")?.reset();
            showToast("Master password changed and vault re-encrypted");
        } catch (changeError) {
            state.cryptoKey = oldKey;
            if (error) error.textContent = changeError.message || "Unable to change master password.";
        }
    });

    const themeSelect =
        document.querySelector(
            "#themeSelect"
        );

    if (themeSelect) {

        themeSelect.value =
            state.darkMode
                ? "dark"
                : "light";

        themeSelect.addEventListener(
            "change",
            () => {

                if (
                    themeSelect.value ===
                    "dark"
                ) {

                    if (!state.darkMode) {

                        toggleTheme();

                    }

                } else {

                    if (state.darkMode) {

                        toggleTheme();

                    }

                }

            }
        );

    }


    const autoLockSelect =
        document.querySelector(
            "#autoLockSelect"
        );

    if (autoLockSelect) {

        autoLockSelect.addEventListener(
            "change",
            () => {

                state.autoLockMinutes =
                    Number(
                        autoLockSelect.value
                    );

                resetAutoLockTimer();

                showToast(
                    "Auto-lock setting updated"
                );

            }
        );

    }


    const clearVaultButton =
        document.querySelector(
            "#clearVaultBtn"
        );

    if (clearVaultButton) {

        clearVaultButton.addEventListener(
            "click",
            clearVault
        );

    }

}


function clearVault() {

    const confirmed =
        confirm(
            "This will permanently delete all saved credentials. Continue?"
        );

    if (!confirmed) return;

    state.credentials = [];
    state.cryptoKey = null;
    state.vaultConfig = null;
    localStorage.removeItem(CONFIG_KEY);
    databaseRequest("readwrite", store => store.clear());

    updateVaultDisplay();

    updateDashboard();

    updateAnalysis();

    showToast(
        "Vault cleared"
    );

    lockVault();

}


/* =========================================================
   SECURE RANDOM PASSWORD
   ========================================================= */

function generateSecurePassword(
    length = 18
) {

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789" +
        "!@#$%^&*()_+-=[]{}|;:,.<>?";

    const values =
        new Uint32Array(
            length
        );

    crypto.getRandomValues(
        values
    );

    let password = "";

    for (
        let i = 0;
        i < length;
        i++
    ) {

        password +=
            characters[
                values[i] %
                characters.length
            ];

    }

    return password;

}


/* =========================================================
   CLIPBOARD
   ========================================================= */

async function copyToClipboard(
    text
) {

    try {

        await navigator.clipboard.writeText(
            text
        );

        return true;

    } catch (error) {

        console.error(
            "Clipboard error:",
            error
        );

        return false;

    }

}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;


function showToast(
    message
) {

    const toast =
        document.querySelector(
            "#toast"
        );

    const toastMessage =
        document.querySelector(
            "#toastMessage"
        );

    if (!toast) return;

    if (toastMessage) {

        toastMessage.textContent =
            message;

    }

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toastTimer
    );

    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2500
        );

}


/* =========================================================
   HELPERS
   ========================================================= */

function setText(
    selector,
    value
) {

    const element =
        document.querySelector(
            selector
        );

    if (element) {

        element.textContent =
            value;

    }

}


function setInputValue(
    selector,
    value
) {

    const input =
        document.querySelector(
            selector
        );

    if (input) {

        input.value =
            value;

    }

}


function getInputValue(
    selector
) {

    const input =
        document.querySelector(
            selector
        );

    return input
        ? input.value
        : "";

}


function escapeHTML(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
            Ctrl + K
            Open vault search
        */

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "k"
        ) {

            event.preventDefault();

            navigateTo("vault");

            const search =
                document.querySelector(
                    "#vaultSearch"
                );

            if (search) {

                search.focus();

            }

        }


        /*
            Escape
            Close modal
        */

        if (
            event.key === "Escape"
        ) {

            closeCredentialModal();

        }

    }
);


/* =========================================================
   INITIAL SECURITY ANALYSIS
   ========================================================= */

setTimeout(
    () => {

        updateAnalysis();

    },
    100
);
