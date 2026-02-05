// ==UserScript==
// @name         RainBet Balance Changer - Second Location Only
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Simple balance changer for second location with real-time updates
// @author       You
// @match        https://rainbet.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let modal = null;
    let isActive = false;
    let observer = null;
    const STORAGE_KEY = 'rainbet_custom_balance';

    // تنسيق الرقم
    function formatNumber(num) {
        const number = parseFloat(num);
        if (isNaN(number)) return num;
        return number.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // حفظ الرصيد
    function saveBalance(balance) {
        localStorage.setItem(STORAGE_KEY, balance);
    }

    // استرجاع الرصيد
    function getSavedBalance() {
        return localStorage.getItem(STORAGE_KEY);
    }

    // تطبيق الرصيد على المكان الثاني فقط
    function updateSecondBalance() {
        if (!isActive) return false;

        const savedBalance = getSavedBalance();
        if (!savedBalance) return false;

        const balanceElements = document.querySelectorAll('.ValueDisplay_value__8zmxa');

        if (balanceElements.length >= 2) {
            const secondElement = balanceElements[1]; // المكان الثاني
            const formattedBalance = formatNumber(savedBalance);
            const newText = `$${formattedBalance}`;

            if (secondElement.textContent !== newText) {
                secondElement.textContent = newText;
                console.log('تم تحديث الرصيد في المكان الثاني:', newText);
                return true;
            }
        }
        return false;
    }

    // بدء المراقبة المستمرة
    function startObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(function() {
            updateSecondBalance();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // تطبيق فوري
        updateSecondBalance();

        // تطبيق متكرر كل 50ms لأول 5 ثوانِ
        let attempts = 0;
        const maxAttempts = 100; // 5 ثوانِ

        const interval = setInterval(() => {
            updateSecondBalance();
            attempts++;

            if (attempts >= maxAttempts) {
                clearInterval(interval);
            }
        }, 50);
    }

    // إيقاف المراقبة
    function stopObserver() {
        isActive = false;
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        localStorage.removeItem(STORAGE_KEY);
        console.log('تم إيقاف تطبيق الرصيد');
    }

    // إنشاء الواجهة
    function createModal() {
        modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            color: white;
            font-family: Arial, sans-serif;
            display: none;
            min-width: 300px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        modal.innerHTML = `
            <div style="margin-bottom: 15px; font-size: 16px; font-weight: bold;">تعديل الرصيد - المكان الثاني</div>
            <div style="margin-bottom: 10px; font-size: 12px; color: #aaa;">
                الحالة: <span id="statusText">${isActive ? 'نشط' : 'غير نشط'}</span>
            </div>
            <input type="text" id="balanceInput" placeholder="أدخل الرصيد الجديد" style="
                width: 100%;
                padding: 8px;
                margin-bottom: 15px;
                border: 1px solid #555;
                border-radius: 4px;
                background: #2a2a2a;
                color: white;
                font-size: 14px;
            ">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <button id="applyBtn" style="
                    flex: 1;
                    padding: 8px;
                    background: #64B425;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">تطبيق</button>
                <button id="stopBtn" style="
                    flex: 1;
                    padding: 8px;
                    background: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">إيقاف</button>
            </div>
            <button id="closeBtn" style="
                width: 100%;
                padding: 8px;
                background: #666;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">إغلاق</button>
        `;

        document.body.appendChild(modal);

        // الأحداث
        const input = modal.querySelector('#balanceInput');
        const applyBtn = modal.querySelector('#applyBtn');
        const stopBtn = modal.querySelector('#stopBtn');
        const closeBtn = modal.querySelector('#closeBtn');

        applyBtn.onclick = applyBalance;
        stopBtn.onclick = function() {
            stopObserver();
            updateStatus();
            hideModal();
        };
        closeBtn.onclick = hideModal;

        input.onkeypress = function(e) {
            if (e.key === 'Enter') applyBalance();
        };
    }

    // تحديث حالة النشاط
    function updateStatus() {
        if (modal) {
            const statusText = modal.querySelector('#statusText');
            if (statusText) {
                statusText.textContent = isActive ? 'نشط' : 'غير نشط';
                statusText.style.color = isActive ? '#64B425' : '#ff4444';
            }
        }
    }

    // تطبيق الرصيد
    function applyBalance() {
        const newBalance = modal.querySelector('#balanceInput').value.trim();
        if (!newBalance) return;

        saveBalance(newBalance);
        isActive = true;
        startObserver();
        updateStatus();
        hideModal();

        console.log('تم تطبيق الرصيد:', newBalance);
    }

    // إظهار الواجهة
    function showModal() {
        if (!modal) createModal();
        modal.style.display = 'block';

        const savedBalance = getSavedBalance();
        if (savedBalance) {
            modal.querySelector('#balanceInput').value = savedBalance;
        }

        updateStatus();
        modal.querySelector('#balanceInput').focus();
    }

    // إخفاء الواجهة
    function hideModal() {
        if (modal) modal.style.display = 'none';
    }

    // الأحداث
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F9') {
            e.preventDefault();
            showModal();
        } else if (e.key === 'Escape' && modal && modal.style.display === 'block') {
            hideModal();
        }
    });

    // التهيئة الأولية
    function initialize() {
        const savedBalance = getSavedBalance();
        if (savedBalance) {
            isActive = true;
            startObserver();
            console.log('تم استرجاع الرصيد المحفوظ:', savedBalance);
        }
    }

    // تشغيل التهيئة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // تطبيق عند اكتمال التحميل
    window.addEventListener('load', function() {
        if (isActive) {
            setTimeout(updateSecondBalance, 500);
        }
    });

    // مراقبة تغيير الصفحات
    let currentUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            if (isActive) {
                setTimeout(() => {
                    startObserver();
                }, 100);
            }
        }
    }).observe(document, { subtree: true, childList: true });

})();
