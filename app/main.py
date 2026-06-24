import subprocess
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from database import engine, Base
from routers import auth, system, dashboard, inbounds, clients, public, settings, update

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="M-Panel API Backend",
    description="FastAPI Backend for M-Panel Xray VPN Management",
    version="1.0.0",
    docs_url=None,
    redoc_url=None
)

# CORS Configuration
origins = [
    "https://panel.mehmetaymaz.com.tr",
    "http://panel.mehmetaymaz.com.tr",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/docs", include_in_schema=False)
def custom_swagger_ui_html():
    custom_style = """
    <style>
        * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }
        *::-webkit-scrollbar {
            display: none !important;
        }
        html, body, .swagger-ui { 
            margin: 0 !important; 
            padding: 0 !important; 
            background-color: var(--bg-primary, #0b0f19) !important; 
            background: var(--bg-primary, #0b0f19) !important;
            color: var(--text-primary, #f3f4f6) !important; 
            font-family: 'Inter', sans-serif !important; 
            overflow-x: hidden !important;
        }
        .swagger-ui { 
            padding: 0 0 40px 0 !important; 
        }
        body.swagger-modal-open-internal,
        body.swagger-modal-open-internal html,
        body.swagger-modal-open-internal .swagger-ui {
            overflow: hidden !important;
            height: 100vh !important;
            height: 100dvh !important;
        }
        .swagger-ui .topbar { 
            display: none !important; 
        }
        .swagger-ui .wrapper {
            max-width: none !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .swagger-ui .info { 
            background: var(--bg-secondary, rgba(18,24,38,0.7)) !important; 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            border-radius: 20px !important; 
            padding: 1.5rem !important; 
            margin: 0 0 25px 0 !important; 
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2) !important;
        }
        .swagger-ui .info .title, 
        .swagger-ui .info li, 
        .swagger-ui .info p, 
        .swagger-ui .info table, 
        .swagger-ui .info td, 
        .swagger-ui .info th { 
            color: var(--text-primary, #f3f4f6) !important; 
        }
        .swagger-ui .info .title { 
            font-weight: 700 !important; 
            color: var(--accent-cyan, #06b6d4) !important; 
            margin-bottom: 8px !important;
        }
        .swagger-ui .opblock-tag {
            background: var(--bg-secondary, rgba(18,24,38,0.7)) !important; 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            border-radius: 12px !important; 
            padding: 12px 20px !important; 
            margin: 20px 0 10px 0 !important; 
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            color: var(--text-primary, #f3f4f6) !important;
            font-size: 1.1rem !important;
        }
        .swagger-ui .opblock-tag a, .swagger-ui .opblock-tag button {
            color: var(--text-primary, #f3f4f6) !important;
            font-weight: 600 !important;
        }
        .swagger-ui .scheme-container { 
            background-color: var(--bg-primary, #0b0f19) !important; 
            position: sticky !important;
            top: 0 !important;
            z-index: 100 !important;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15) !important; 
            border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            padding: 12px 5px !important; 
            margin: 0 0 20px 0 !important;
            display: flex !important;
            justify-content: flex-end !important;
        }
        .swagger-ui select { 
            background-color: var(--bg-input, #111827) !important; 
            color: var(--text-primary, #f3f4f6) !important; 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            border-radius: 8px !important; 
            padding: 6px 12px !important; 
        }
        .swagger-ui .opblock { 
            background: var(--bg-secondary, rgba(18,24,38,0.7)) !important; 
            border-radius: 12px !important; 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important; 
            margin: 0 0 12px 0 !important;
        }
        .swagger-ui .opblock .opblock-summary { 
            border-radius: 12px !important; 
        }
        .swagger-ui .opblock .opblock-summary-method { 
            border-radius: 8px !important; 
            font-weight: bold !important; 
        }
        .swagger-ui .opblock.opblock-get { 
            border-color: rgba(6, 182, 212, 0.3) !important; 
            background: rgba(6, 182, 212, 0.03) !important; 
        }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { 
            background: var(--accent-cyan, #06b6d4) !important; 
            color: var(--bg-primary, #0b0f19) !important; 
        }
        .swagger-ui .opblock.opblock-post { 
            border-color: rgba(16, 185, 129, 0.3) !important; 
            background: rgba(16, 185, 129, 0.03) !important; 
        }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { 
            background: var(--success, #10b981) !important; 
            color: var(--bg-primary, #0b0f19) !important; 
        }
        .swagger-ui .opblock.opblock-put { 
            border-color: rgba(245, 158, 11, 0.3) !important; 
            background: rgba(245, 158, 11, 0.03) !important; 
        }
        .swagger-ui .opblock.opblock-put .opblock-summary-method { 
            background: var(--warning, #f59e0b) !important; 
            color: var(--bg-primary, #0b0f19) !important; 
        }
        .swagger-ui .opblock.opblock-delete { 
            border-color: rgba(239, 68, 68, 0.3) !important; 
            background: rgba(239, 68, 68, 0.03) !important; 
        }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { 
            background: var(--danger, #ef4444) !important; 
            color: #ffffff !important; 
        }
        .swagger-ui .opblock-section-header { 
            background: transparent !important; 
        }
        .swagger-ui .tabli button { 
            color: var(--text-primary, #f3f4f6) !important; 
        }
        .swagger-ui .opblock-body pre { 
            background-color: var(--bg-input, #090d16) !important; 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            border-radius: 8px !important; 
            color: var(--text-primary, #d1d5db) !important; 
        }
        
        /* Premium custom dialog (modal-overlay / info details modal styling) */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .dialog-ux {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(10, 15, 30, 0.45) !important;
            backdrop-filter: blur(25px) !important;
            -webkit-backdrop-filter: blur(25px) !important;
            box-shadow: inset 0 0 120px rgba(0, 0, 0, 0.85) !important;
            z-index: 999999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 1.5rem !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        }
        [data-theme='light'] .dialog-ux {
            background: rgba(255, 255, 255, 0.45) !important;
            box-shadow: inset 0 0 120px rgba(255, 255, 255, 0.25) !important;
        }
        .dialog-ux .modal-ux { 
            position: relative !important;
            top: auto !important;
            left: auto !important;
            transform: none !important;
            background-color: var(--bg-modal-solid, #151d30) !important; 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            border-radius: 24px !important; 
            box-shadow: 0 0 15px rgba(6, 182, 212, 0.25) !important; /* glow-cyan style */
            padding: 1.5rem !important;
            max-width: 520px !important;
            width: 100% !important;
            min-height: 610px !important;
            max-height: 95vh !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            animation: fadeIn 0.4s ease-out forwards !important;
        }
        .dialog-ux .modal-ux-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 0.5rem !important;
            border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important;
            padding-bottom: 0.75rem !important;
            background: transparent !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
        }
        .dialog-ux .modal-ux-header h3,
        .dialog-ux .modal-ux-header h2 { 
            color: var(--text-primary, #f3f4f6) !important; 
            font-size: 1.25rem !important;
            font-weight: 600 !important;
            font-family: 'Inter', sans-serif !important;
            margin: 0 !important;
        }
        .dialog-ux .modal-ux-header button,
        .dialog-ux .modal-ux-header .close-modal {
            background: rgba(255, 255, 255, 0.03) !important;
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important;
            color: var(--text-secondary, #9ca3af) !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            transition: all 0.25s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 32px !important;
            height: 32px !important;
            font-size: 1.2rem !important;
            padding: 0 !important;
            line-height: 1 !important;
        }
        .dialog-ux .modal-ux-header button:hover,
        .dialog-ux .modal-ux-header .close-modal:hover {
            background: rgba(239, 68, 68, 0.1) !important;
            border-color: rgba(239, 68, 68, 0.2) !important;
            color: var(--danger, #ef4444) !important;
            transform: rotate(90deg) !important;
        }
        .dialog-ux .modal-ux,
        .dialog-ux .modal-dialog-ux,
        .dialog-ux .modal-ux-inner,
        .dialog-ux .modal-ux-content {
            overflow: hidden !important;
            overflow-y: hidden !important;
        }
        .dialog-ux .modal-ux-content {
            padding: 0 !important;
        }
        .dialog-ux .modal-ux-content h4 { 
            color: var(--text-primary, #f3f4f6) !important; 
            font-size: 1rem !important;
            font-weight: 600 !important;
            margin: 0 0 0.5rem 0 !important;
        }
        .dialog-ux .modal-ux-content p {
            display: none !important;
        }
        .dialog-ux .scope-def {
            display: none !important;
        }
        .dialog-ux .modal-ux-content .wrapper {
            margin: 0 0 0.5rem 0 !important;
            padding: 0 !important;
        }
        .dialog-ux .modal-ux-content label {
            color: var(--text-secondary, #9ca3af) !important;
            font-size: 0.85rem !important;
            font-weight: 500 !important;
            margin-top: 1rem !important;
            display: block !important;
        }
        .dialog-ux input[type=text],
        .dialog-ux input[type=password] { 
            width: 100% !important;
            padding: 0.75rem 1rem !important;
            background-color: var(--bg-input, #111827) !important; 
            color: var(--text-primary, #f3f4f6) !important; 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            border-radius: 8px !important; 
            font-size: 0.95rem !important;
            font-family: inherit !important;
            transition: all 0.2s ease !important;
            margin-top: 0.25rem !important;
            box-sizing: border-box !important;
        }
        .dialog-ux input[type=text]:focus,
        .dialog-ux input[type=password]:focus { 
            outline: none !important;
            border-color: var(--accent-purple, #8b5cf6) !important; 
            box-shadow: 0 0 0 2px var(--border-focus, rgba(139, 92, 246, 0.15)) !important;
        }
        
        /* Custom Select Dropdown Styling */
        .custom-select-container {
            position: relative !important;
            display: inline-block !important;
            min-width: 180px !important;
            margin-top: 0.35rem !important;
        }
        .custom-select-button {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 0.5rem !important;
            background: var(--bg-secondary, #121826) !important;
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important;
            border-radius: 12px !important;
            padding: 0.5rem 1rem !important;
            color: var(--text-primary, #f3f4f6) !important;
            font-size: 0.85rem !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            height: 36px !important;
            width: 100% !important;
            transition: all 0.2s ease !important;
            box-sizing: border-box !important;
            outline: none !important;
        }
        .custom-select-button:hover {
            border-color: rgba(255, 255, 255, 0.15) !important;
            background: var(--bg-secondary-hover, rgba(255, 255, 255, 0.05)) !important;
        }
        .custom-select-button:focus {
            outline: none !important;
            border-color: var(--accent-cyan, #06b6d4) !important;
            box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15) !important;
        }
        .custom-select-dropdown {
            position: absolute !important;
            top: calc(100% + 8px) !important;
            left: 0 !important;
            background: var(--bg-modal-solid, #151d30) !important;
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important;
            border-radius: 16px !important;
            padding: 0.5rem !important;
            display: none !important;
            flex-direction: column !important;
            gap: 4px !important;
            min-width: 200px !important;
            z-index: 999999 !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3) !important;
            animation: dropdownFadeIn 0.2s ease-out forwards !important;
        }
        .custom-select-dropdown.open {
            display: flex !important;
        }
        @keyframes dropdownFadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .custom-select-item {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
            padding: 0.5rem 0.75rem !important;
            border-radius: 8px !important;
            background: transparent !important;
            color: var(--text-secondary, #9ca3af) !important;
            border: none !important;
            font-size: 0.85rem !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            text-align: left !important;
            transition: all 0.15s ease !important;
            box-sizing: border-box !important;
        }
        .custom-select-item:hover {
            background: var(--bg-secondary, rgba(255, 255, 255, 0.04)) !important;
            color: var(--text-primary, #f3f4f6) !important;
        }
        .custom-select-item.active {
            background: var(--bg-secondary, rgba(255, 255, 255, 0.04)) !important;
            color: var(--accent-cyan, #06b6d4) !important;
            font-weight: 700 !important;
        }
        .custom-select-item .checkmark {
            color: var(--accent-cyan, #06b6d4) !important;
            font-weight: bold !important;
        }
        .dialog-ux .modal-ux-content .auth-container {
            display: block !important;
            margin-top: 0 !important;
            border-top: none !important;
            padding-top: 0 !important;
            text-align: left !important;
        }
        .dialog-ux .modal-ux-content .auth-container + .auth-container {
            border-top: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important;
            margin-top: 1.5rem !important;
            padding-top: 1rem !important;
        }
        .dialog-ux .modal-ux-content .auth-btn-wrapper {
            display: flex !important;
            justify-content: flex-end !important;
            align-items: center !important;
            gap: 1.5rem !important;
            margin-top: 1.5rem !important;
            border-top: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important;
            padding-top: 1.25rem !important;
        }
        .dialog-ux .modal-ux-content .auth-btn-wrapper .btn {
            padding: 0.65rem 1.5rem !important;
            font-size: 0.95rem !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            border-radius: 8px !important; 
            box-shadow: none !important;
            border: none !important;
        }
        .dialog-ux .modal-ux-content .auth-btn-wrapper .btn.authorize {
            background: var(--accent-purple, #8b5cf6) !important;
            color: white !important;
            border: none !important;
        }
        .dialog-ux .modal-ux-content .auth-btn-wrapper .btn.authorize:hover {
            filter: brightness(1.08) !important;
            transform: translateY(-1px) !important;
        }
        .dialog-ux .modal-ux-content .auth-btn-wrapper .btn.close {
            background: transparent !important;
            border: none !important;
            color: var(--text-secondary, #9ca3af) !important;
            padding: 0.65rem 0.5rem !important;
        }
        .dialog-ux .modal-ux-content .auth-btn-wrapper .btn.close:hover {
            background: transparent !important;
            color: var(--text-primary, #f3f4f6) !important;
        }
        
        /* Keep main authorize trigger button styled */
        .swagger-ui .btn { 
            border-radius: 12px !important; 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            background: rgba(255,255,255,0.03) !important; 
            color: var(--text-primary, #f3f4f6) !important; 
            font-weight: 600 !important;
            transition: all 0.2s ease !important;
        }
        .swagger-ui .btn.authorize { 
            border-color: var(--accent-cyan, #06b6d4) !important; 
            color: var(--accent-cyan, #06b6d4) !important; 
        }
        .swagger-ui .btn.authorize svg { 
            fill: var(--accent-cyan, #06b6d4) !important; 
        }
        
        .swagger-ui .model { 
            color: var(--text-primary, #f3f4f6) !important; 
        }
        .swagger-ui .model-title { 
            color: var(--text-primary, #f3f4f6) !important; 
        }
        .swagger-ui section.models { 
            border: 1px solid var(--border-color, rgba(255,255,255,0.08)) !important; 
            border-radius: 12px !important; 
            background: var(--bg-secondary, rgba(18,24,38,0.7)) !important; 
        }
        .swagger-ui section.models .model-container { 
            background: transparent !important; 
        }
        .swagger-ui section.models h4 { 
            color: var(--text-primary, #f3f4f6) !important; 
        }
        .swagger-ui section.models .model-box { 
            background: transparent !important; 
        }
        .swagger-ui .prop-type { 
            color: var(--accent-purple, #a855f7) !important; 
        }
        .swagger-ui .prop-format { 
            color: var(--text-muted, #6b7280) !important; 
        }
        

    </style>
    """
    
    sync_script = """
    <script>
        function replaceNativeSelects() {
            try {
                const selectEls = document.querySelectorAll('.dialog-ux select:not(.custom-select-replaced)');
                selectEls.forEach(selectEl => {
                    selectEl.classList.add('custom-select-replaced');
                    selectEl.style.setProperty('display', 'none', 'important');
                    
                    const container = document.createElement('div');
                    container.className = 'custom-select-container';
                    
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'custom-select-button';
                    
                    const labelSpan = document.createElement('span');
                    const arrowSpan = document.createElement('span');
                    arrowSpan.textContent = '▼';
                    arrowSpan.style.fontSize = '0.65rem';
                    arrowSpan.style.opacity = '0.6';
                    
                    button.appendChild(labelSpan);
                    button.appendChild(arrowSpan);
                    container.appendChild(button);
                    
                    const dropdown = document.createElement('div');
                    dropdown.className = 'custom-select-dropdown';
                    container.appendChild(dropdown);
                    
                    selectEl.parentNode.insertBefore(container, selectEl.nextSibling);
                    
                    function updateDropdown() {
                        const options = Array.from(selectEl.options);
                        const selectedVal = selectEl.value;
                        
                        const activeOpt = options.find(o => o.value === selectedVal) || options[0];
                        labelSpan.textContent = activeOpt ? activeOpt.textContent : '';
                        
                        dropdown.innerHTML = '';
                        options.forEach(opt => {
                            const item = document.createElement('button');
                            item.type = 'button';
                            item.className = 'custom-select-item';
                            if (opt.value === selectedVal) {
                                item.classList.add('active');
                            }
                            
                            const itemText = document.createElement('span');
                            itemText.textContent = opt.textContent;
                            item.appendChild(itemText);
                            
                            if (opt.value === selectedVal) {
                                const check = document.createElement('span');
                                check.className = 'checkmark';
                                check.textContent = '✓';
                                item.appendChild(check);
                            }
                            
                            item.addEventListener('click', (e) => {
                                e.stopPropagation();
                                selectEl.value = opt.value;
                                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                                updateDropdown();
                                dropdown.classList.remove('open');
                            });
                            
                            dropdown.appendChild(item);
                        });
                    }
                    
                    button.addEventListener('click', (e) => {
                        e.stopPropagation();
                        document.querySelectorAll('.custom-select-dropdown').forEach(d => {
                            if (d !== dropdown) d.classList.remove('open');
                        });
                        dropdown.classList.toggle('open');
                    });
                    
                    updateDropdown();
                    
                    document.addEventListener('click', () => {
                        dropdown.classList.remove('open');
                    });
                });
            } catch (e) {
                console.error("Failed to replace native selects:", e);
            }
        }

        function syncTheme() {
            try {
                if (window.parent && window.parent.document) {
                    const parentHtml = window.parent.document.documentElement;
                    const theme = parentHtml.getAttribute('data-theme') || 'dark';
                    if (document.documentElement.getAttribute('data-theme') !== theme) {
                        document.documentElement.setAttribute('data-theme', theme);
                    }
                }
            } catch (e) {
                console.error("Theme sync failed:", e);
            }
        }
        
        function copyParentStylesheets() {
            try {
                if (window.parent && window.parent.document) {
                    const parentLinks = window.parent.document.querySelectorAll('link[rel="stylesheet"]');
                    parentLinks.forEach(link => {
                        if (!document.querySelector(`link[href="${link.href}"]`)) {
                            const newLink = document.createElement('link');
                            newLink.rel = 'stylesheet';
                            newLink.href = link.href;
                            document.head.appendChild(newLink);
                        }
                    });
                }
            } catch (e) {
                console.error("Failed to copy stylesheets:", e);
            }
        }
        
        // Monitor Swagger UI modal presence and sync class with parent body
        function setupModalObserver() {
            try {
                const observer = new MutationObserver(() => {
                    const hasModal = document.querySelector('.dialog-ux') !== null;
                    if (hasModal) {
                        if (window.parent && window.parent.document) {
                            window.parent.document.body.classList.add('swagger-modal-open');
                        }
                        document.body.classList.add('swagger-modal-open-internal');
                        document.body.style.setProperty('overflow', 'hidden', 'important');
                        document.documentElement.style.setProperty('overflow', 'hidden', 'important');
                        replaceNativeSelects();
                    } else {
                        if (window.parent && window.parent.document) {
                            window.parent.document.body.classList.remove('swagger-modal-open');
                        }
                        document.body.classList.remove('swagger-modal-open-internal');
                        document.body.style.removeProperty('overflow');
                        document.documentElement.style.removeProperty('overflow');
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (e) {
                console.error("Modal observer setup failed:", e);
            }
        }
        
        copyParentStylesheets();
        syncTheme();
        setInterval(syncTheme, 500);
        setupModalObserver();
    </script>
    """

    html = get_swagger_ui_html(
        openapi_url="openapi.json",
        title=app.title + " - API Documents"
    )
    html_content = html.body.decode("utf-8").replace("</head>", f"{custom_style}</head>").replace("</body>", f"{sync_script}</body>")
    return HTMLResponse(content=html_content)

# Root/Health Check Endpoint
@app.get("/health")
def health_check():
    xray_active = False
    try:
        res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
        xray_active = res.stdout.strip() == "active"
    except Exception:
        pass
        
    return {
        "status": "ok",
        "xray_active": xray_active
    }

@app.on_event("startup")
def startup_event():
    from stats_collector import start_collector
    from xray_manager import sync_inbounds_to_ufw
    
    # Check and complete update status if we just restarted from an update
    try:
        import os
        import json
        STATUS_FILE = "/opt/m-panel/app/data/update_status.json"
        if os.path.exists(STATUS_FILE):
            with open(STATUS_FILE, "r") as f:
                status = json.load(f)
            if status.get("in_progress") and status.get("current_step") == 7:
                status["in_progress"] = False
                status["completed"] = True
                status["step_label"] = "Güncelleme tamamlandı!"
                with open(STATUS_FILE, "w") as f:
                    json.dump(status, f)
    except Exception as e:
        print(f"Uyarı: Başlangıçta güncelleme durumu kontrolü başarısız: {e}")

    try:
        sync_inbounds_to_ufw()
    except Exception as e:
        print(f"Uyarı: Başlangıçta UFW senkronizasyonu başarısız: {e}")
    start_collector()

@app.on_event("shutdown")
def shutdown_event():
    from stats_collector import stop_collector
    stop_collector()

# Include Routers
app.include_router(public.router)
app.include_router(auth.router)
app.include_router(system.router)
app.include_router(dashboard.router)
app.include_router(inbounds.router)
app.include_router(clients.router)
app.include_router(settings.router)
app.include_router(update.router)
