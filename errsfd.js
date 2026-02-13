// ==UserScript==
// @name         Stake Custom  Chat Button
// @namespace    http://tampermonkey.net/
// @version      2025-12-26-F9-Fixed-with-Save-Button-Enter-Fixed-Chat-Button
// @description  Hide original elements and replace with custom ones + F9 Balance Adjuster + Save Balance + Fixed Enter Duplication + Chat Button Integration
// @author       You
// @match        https://stake.ceo/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=stake.ceo
// @grant        none
// ==/UserScript==

(function() {
'use strict';

// متغيرات لتخزين القيم والحالة
let baseAmount = 0;
let currentMultiplier = 0;
let profitObserver = null;
let profitSection = null;
let gameResultObserver = null;
let isGameResultVisible = false; // متغير لتتبع حالة نافذة النتائج

// متغيرات خاصة بنافذة F9
let f9WindowVisible = false;
let f9Window = null;

// متغير لمنع الخصم المضاعف - محسّن
let lastBetTime = 0;
let betProcessed = false;

// متغيرات لمنع تكرار إضافة xinp1 عند الضغط على Enter - جديد
let lastEnterTime = 0;
let enterProcessed = false;
let enterListenerAdded = false; // فلاغ لضمان إضافة مستمع Enter مرة واحدة فقط

// متغيرات لمراقبة زر Chat
let chatButtonObserver = null;

// ================= Chat Button Integration Functions =================

// دالة إعداد مراقبة زر Chat
function setupChatButtonMonitor() {
    // البحث عن زر Chat الحالي
    const chatButton = document.querySelector('[data-analytics="mobile-navbar-chat"]');

    if (chatButton) {
        console.log('تم العثور على زر Chat - إضافة مستمع النقر');
        addChatButtonListener(chatButton);
    }

    // إعداد مراقب لمراقبة إضافة أزرار Chat جديدة
    if (chatButtonObserver) {
        chatButtonObserver.disconnect();
    }

    chatButtonObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        // البحث عن زر Chat في العقدة الجديدة
                        let chatButton = null;

                        if (node.getAttribute && node.getAttribute('data-analytics') === 'mobile-navbar-chat') {
                            chatButton = node;
                        } else if (node.querySelector) {
                            chatButton = node.querySelector('[data-analytics="mobile-navbar-chat"]');
                        }

                        if (chatButton) {
                            console.log('تم اكتشاف زر Chat جديد - إضافة مستمع النقر');
                            addChatButtonListener(chatButton);
                        }
                    }
                });
            }
        });
    });

    chatButtonObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('تم إعداد مراقبة زر Chat');
}

// دالة إضافة مستمع النقر لزر Chat
function addChatButtonListener(chatButton) {
    // التأكد من عدم إضافة المستمع أكثر من مرة
    if (chatButton.hasAttribute('f9-listener-added')) {
        return;
    }

    chatButton.addEventListener('click', function(e) {
        e.preventDefault(); // منع السلوك الافتراضي للزر
        e.stopPropagation(); // منع انتشار الحدث
        e.stopImmediatePropagation(); // منع جميع المستمعين الآخرين

        console.log('تم النقر على زر Chat - إظهار نافذة F9');
        showF9Window();

        // منع أي محاولة لفتح الشات
        return false;
    }, true); // استخدام capture phase للتأكد من التنفيذ أولاً

    // وضع علامة أن المستمع تم إضافته
    chatButton.setAttribute('f9-listener-added', 'true');

    // إضافة مستمع إضافي لمنع أي أحداث أخرى
    chatButton.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }, true);

    chatButton.addEventListener('mouseup', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }, true);

    // تعطيل الرابط إذا كان موجوداً
    if (chatButton.tagName === 'A') {
        chatButton.removeAttribute('href');
    }

    // إزالة أي مستمعين آخرين قد يكونوا موجودين
    const newChatButton = chatButton.cloneNode(true);
    chatButton.parentNode.replaceChild(newChatButton, chatButton);

    // إعادة إضافة المستمع الجديد للعنصر المستنسخ
    newChatButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('تم النقر على زر Chat - إظهار نافذة F9');
        showF9Window();
        return false;
    }, true);

    newChatButton.setAttribute('f9-listener-added', 'true');

    console.log('تم إضافة مستمع النقر لزر Chat');
}

// ================= Balance Save/Load Functions =================

// دالة حفظ الرصيد
function saveBalance() {
    const element = getBalanceElement();
    if (element) {
        const currentValue = extractNumericValue(element.textContent || '');
        localStorage.setItem('stake_last_balance', currentValue.toString());
        console.log(`تم حفظ الرصيد: ${currentValue}`);
    }
}

// دالة استرجاع الرصيد المحفوظ
function loadSavedBalance() {
    const savedBalance = localStorage.getItem('stake_last_balance');
    if (savedBalance) {
        const balanceValue = parseFloat(savedBalance);
        if (!isNaN(balanceValue)) {
            // انتظار تحميل عنصر الرصيد
            const checkBalance = setInterval(() => {
                const element = getBalanceElement();
                if (element) {
                    element.textContent = formatCurrency(balanceValue);
                    console.log(`تم استرجاع الرصيد المحفوظ: ${formatCurrency(balanceValue)}`);
                    clearInterval(checkBalance);
                }
            }, 10);

            // إيقاف المحاولة بعد 10 ثوان
            setTimeout(() => clearInterval(checkBalance), 10000);
        }
    }
}

// دالة تهيئة حفظ الرصيد
function initBalanceSave() {
    // حفظ الرصيد عند مغادرة الصفحة
    window.addEventListener('beforeunload', saveBalance);

    // حفظ الرصيد عند إخفاء الصفحة (للهواتف المحمولة)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveBalance();
        }
    });

    // حفظ الرصيد كل 5 ثوان (احتياطي)
    setInterval(saveBalance, 5000);

    // استرجاع الرصيد المحفوظ فور تحميل الصفحة
    setTimeout(loadSavedBalance, 100);

    console.log('تم تفعيل ميزة حفظ واسترجاع الرصيد');
}

// دالة لتنسيق الأرقام بالفواصل
function formatNumber(num) {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// دالة لاستبدال العنصر الأصلي بالجديد
function replaceElement(originalSelector, newElementHTML, newElementId) {
    const originalElement = document.querySelector(originalSelector);
    if (originalElement && !document.getElementById(newElementId)) {
        originalElement.style.display = 'none';
        const newElement = document.createElement('div');
        newElement.innerHTML = newElementHTML;
        originalElement.parentNode.insertBefore(newElement.firstElementChild, originalElement);
        console.log(`تم استبدال العنصر: ${originalSelector}`);
        return true;
    }
    return false;
}

// دالة لاستخراج قيمة المضاعف من النص
function extractMultiplier(text) {
    const match = text.match(/\((\d+\.?\d*)[×x]\)/i);
    return match ? parseFloat(match[1]) : 0;
}

// دالة لاستخراج المضاعف من نافذة النتائج
function extractGameResultMultiplier(text) {
    const match = text.match(/(\d+\.?\d*)[×x]/i);
    return match ? parseFloat(match[1]) : 0;
}

// دالة لمراقبة نافذة نتائج اللعبة
function setupGameResultMonitor() {
    // إلغاء المراقب السابق إن وجد
    if (gameResultObserver) {
        gameResultObserver.disconnect();
    }

    // إعداد مراقب لمراقبة ظهور نافذة النتائج
    gameResultObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        // البحث عن عنصر نافذة النتائج
                        let gameResultWrap = null;

                        if (node.classList && node.classList.contains('game-result-wrap') && node.classList.contains('win')) {
                            gameResultWrap = node;
                        } else {
                            gameResultWrap = node.querySelector && node.querySelector('.game-result-wrap.win');
                        }

                        if (gameResultWrap) {
                            isGameResultVisible = true;
                            console.log('نافذة النتائج ظهرت - تم إيقاف مراقبة Total Profit');
                            processGameResult(gameResultWrap);

                            // مراقبة اختفاء النافذة
                            const hideObserver = new MutationObserver(function(hideMutations) {
                                hideMutations.forEach(function(hideMutation) {
                                    if (hideMutation.type === 'childList') {
                                        hideMutation.removedNodes.forEach(function(removedNode) {
                                            if (removedNode === gameResultWrap ||
                                                (removedNode.nodeType === 1 && removedNode.contains && removedNode.contains(gameResultWrap))) {
                                                isGameResultVisible = false;
                                                console.log('نافذة النتائج اختفت - تم استئناف مراقبة Total Profit');
                                                hideObserver.disconnect();
                                            }
                                        });
                                    }
                                });
                            });

                            hideObserver.observe(document.body, {
                                childList: true,
                                subtree: true
                            });
                        }
                    }
                });
            }
        });
    });

    gameResultObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('تم إعداد مراقبة نافذة نتائج اللعبة');
}

// دالة لمعالجة نتائج اللعبة
function processGameResult(gameResultElement) {
    try {
        // البحث عن المضاعف
        const multiplierElement = gameResultElement.querySelector('.number-multiplier span[data-ds-text="true"]');
        if (!multiplierElement) {
            console.log('لم يتم العثور على عنصر المضاعف');
            return;
        }

        const multiplierText = multiplierElement.textContent;
        const multiplier = extractGameResultMultiplier(multiplierText);

        if (multiplier <= 0 || baseAmount <= 0) {
            console.log('المضاعف أو المبلغ الأساسي غير صالح:', multiplier, baseAmount);
            return;
        }

        // حساب النتيجة
        const result = baseAmount * multiplier;
        const formattedResult = formatNumber(result);

        // البحث عن عنصر المبلغ ($0.00)
        const payoutElement = gameResultElement.querySelector('.payout-result.win .content span[data-ds-text="true"]');
        if (!payoutElement) {
            console.log('لم يتم العثور على عنصر المبلغ');
            return;
        }

        // تحديث القيمة
        payoutElement.textContent = `$${formattedResult}`;

        // إضافة الربح للرصيد
        updateBalance(result);
        console.log(`✓ تم إضافة الربح للرصيد: $${formattedResult}`);

        console.log(`تم تحديث نتيجة اللعبة: ${baseAmount} × ${multiplier} = $${formattedResult}`);

    } catch (error) {
        console.error('خطأ في معالجة نتائج اللعبة:', error);
    }
}

// دالة سريعة لتحديث القيم
function updateProfitValues(multiplier) {
    // منع التحديث إذا كانت نافذة النتائج مرئية
    if (isGameResultVisible) {
        console.log('تم منع تحديث القيم - نافذة النتائج مرئية');
        return;
    }

    if (!profitSection) {
        profitSection = document.querySelector('.profit.svelte-gpd1jr');
        if (!profitSection) return;
    }

    const usdtDisplay = profitSection.querySelector('[data-testid="conversion-amount"] span');
    const profitInput = profitSection.querySelector('[data-testid="profit-input"]');

    // بدء الاحتساب فقط عندما يكون المضاعف أكبر من 1.00
    if (multiplier > 1.00 && baseAmount > 0) {
        const newValue = baseAmount * multiplier;
        const formattedUSDT = newValue.toFixed(8);
        const formattedProfit = newValue.toFixed(2);

        if (usdtDisplay) {
            usdtDisplay.textContent = `${formattedUSDT}\n          USDT`;
        }
        if (profitInput) {
            profitInput.value = formattedProfit;
        }
    } else {
        // إعادة تعيين القيم إذا كان المضاعف 1.00 أو أقل
        if (usdtDisplay) {
            usdtDisplay.textContent = `0.00000000\n          USDT`;
        }
        if (profitInput) {
            profitInput.value = '0.00';
        }
    }
}

// دالة لمراقبة Total Profit
function setupProfitMonitor() {
    profitSection = document.querySelector('.profit.svelte-gpd1jr');
    if (!profitSection) return false;

    const totalProfitLabel = profitSection.querySelector('span[slot="label"]');
    if (!totalProfitLabel || !totalProfitLabel.textContent.includes('Total Profit')) return false;

    // إلغاء المراقب السابق إن وجد
    if (profitObserver) {
        profitObserver.disconnect();
    }

    // إعداد مراقب جديد
    profitObserver = new MutationObserver(function(mutations) {
        // تجاهل التحديثات إذا كانت نافذة النتائج مرئية
        if (isGameResultVisible) {
            return;
        }

        const newText = totalProfitLabel.textContent;
        const newMultiplier = extractMultiplier(newText);

        // تحديث القيم فقط إذا تغير المضاعف وكان أكبر من 1.00
        if (newMultiplier !== currentMultiplier) {
            currentMultiplier = newMultiplier;
            // تحديث القيم فقط إذا كان المضاعف أكبر من 1.00
            if (currentMultiplier > 1.00) {
                updateProfitValues(currentMultiplier);
            } else {
                // إعادة تعيين القيم إذا كان المضاعف 1.00 أو أقل
                updateProfitValues(0);
            }
        }
    });

    profitObserver.observe(totalProfitLabel, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // فحص أولي
    const initialMultiplier = extractMultiplier(totalProfitLabel.textContent);
    if (initialMultiplier >= 0) {
        currentMultiplier = initialMultiplier;
        // تحديث القيم فقط إذا كان المضاعف أكبر من 1.00
        if (currentMultiplier > 1.00) {
            updateProfitValues(currentMultiplier);
        } else {
            updateProfitValues(0);
        }
    }

    console.log('تم إعداد مراقبة Total Profit');
    return true;
}

// دالة لمراقبة حالة التعطيل
function syncDisabledState() {
    const originalInput = document.querySelector('[data-testid="input-game-amount"]:not(#xinp1)');
    const newInput = document.getElementById('xinp1');

    if (originalInput && newInput) {
        newInput.disabled = originalInput.disabled;

        const disableObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
                    newInput.disabled = originalInput.disabled;

                    // عند تعطيل الحقل، حفظ القيمة الحالية
                    if (originalInput.disabled && newInput.value && newInput.value !== '0.00') {
                        baseAmount = parseFloat(newInput.value) || 0;
                        console.log('تم حفظ المبلغ الأساسي عند التعطيل:', baseAmount);
                    }
                }
            });
        });

        disableObserver.observe(originalInput, {
            attributes: true,
            attributeFilter: ['disabled']
        });
    }
}

// دالة إضافة قيمة xinp1 للرصيد (محسنة مع منع التكرار)
function addXinp1ToBalance() {
    const currentTime = Date.now();

    // منع التنفيذ إذا تم تنفيذه مؤخراً (خلال نصف ثانية) أو إذا كان قيد التنفيذ
    if (currentTime - lastEnterTime < 500 || enterProcessed) {
        console.log('تم منع تكرار إضافة xinp1 - انتظار...');
        return false;
    }

    // وضع علامة أنه تم التنفيذ
    enterProcessed = true;
    lastEnterTime = currentTime;

    const xinp1 = document.getElementById('xinp1');
    if (xinp1 && xinp1.value) {
        const value = parseFloat(xinp1.value);
        if (!isNaN(value) && value > 0) {
            updateBalance(value);
            console.log(`✓ تم إضافة ${value} للرصيد عبر Enter`);

            // إعادة تعيين العلامة بعد فترة قصيرة
            setTimeout(() => {
                enterProcessed = false;
            }, 1000);

            return true;
        }
    }

    // إعادة تعيين العلامة في حالة الفشل
    setTimeout(() => {
        enterProcessed = false;
    }, 500);

    return false;
}

// دالة لربط الـ input بعنصر العرض
function setupElementBinding() {
    const input = document.getElementById('xinp1');
    const displayElement = document.querySelector('#xnumb1 span');

    if (!input || !displayElement) return;

    // عند التركيز
    input.addEventListener('focus', function() {
        if (this.value === '0.00') {
            this.value = '';
        }
    });

    // أثناء الكتابة
    input.addEventListener('input', function() {
        const value = parseFloat(this.value) || 0;
        baseAmount = value;
        const formattedValue = value.toFixed(8);
        displayElement.textContent = `${formattedValue} USDT`;

        // تحديث فوري إذا كان هناك مضاعف
        if (currentMultiplier > 1.00) {
            updateProfitValues(currentMultiplier);
        }
    });

    // منع ضغطة Enter داخل حقل xinp1 من استدعاء الدالة مرتين
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // منع السلوك الافتراضي
            addXinp1ToBalance(); // تنفيذ الدالة مرة واحدة فقط
        }
    });

    // عند الانتهاء من الكتابة
    input.addEventListener('blur', function() {
        if (this.value === '' || this.value === '0') {
            this.value = '0.00';
            baseAmount = 0;
        } else {
            const value = parseFloat(this.value) || 0;
            this.value = value.toFixed(2);
            baseAmount = value;

            const formattedValue = value.toFixed(8);
            displayElement.textContent = `${formattedValue} USDT`;

            if (currentMultiplier > 1.00) {
                updateProfitValues(currentMultiplier);
            }
        }
    });

    syncDisabledState();
    console.log('تم ربط العناصر المخصصة');
}

// دالة لاستبدال العناصر
function replaceElements() {
    const inputReplaced = replaceElement(
        '[data-testid="input-game-amount"]',
        '<input id="xinp1" autocomplete="on" class="input spacing-expanded svelte-dka04o" type="number" data-testid="input-game-amount" data-bet-amount-active-currency="usdt" step="0.01" value="0.00">',
        'xinp1'
    );

    const displayReplaced = replaceElement(
        '[data-testid="conversion-amount"]',
        '<div id="xnumb1" class="crypto svelte-1pm8uy8" data-testid="conversion-amount"><span type="body" tag="span" size="sm" class="ds-body-sm" data-ds-text="true">0.00000000 USDT</span></div>',
        'xnumb1'
    );

    if (inputReplaced || displayReplaced) {
        setupElementBinding();
        // تأخير قصير لضمان تحميل العناصر
        setTimeout(setupProfitMonitor, 500);
    }
}

// مراقبة تغييرات الصفحة
const pageObserver = new MutationObserver(function(mutations) {
    let shouldReplace = false;

    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            shouldReplace = true;
        }
    });

    if (shouldReplace) {
        setTimeout(replaceElements, 100);
        setTimeout(setupProfitMonitor, 600);
        // إعادة إعداد مراقبة زر Chat عند تغيير الصفحة
        setTimeout(setupChatButtonMonitor, 100);
    }
});

// ================= F9 Balance Adjuster Functions =================

// دالة إنشاء نافذة F9
function createF9Window() {
    if (f9Window) return;

    f9Window = document.createElement('div');
    f9Window.id = 'f9-balance-window';
    f9Window.innerHTML = `
        <div class="f9-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
            <div class="f9-modal" style="
                background: white;
                border-radius: 12px;
                padding: 24px;
                width: 400px;
                max-width: 90vw;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            ">
                <div class="f9-header" style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 24px;
                ">
                    <h2 style="
                        font-size: 20px;
                        font-weight: bold;
                        color: #1f2937;
                        margin: 0;
                    ">تعديل الرصيد</h2>
                    <button class="f9-close" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        color: #6b7280;
                        cursor: pointer;
                        line-height: 1;
                        padding: 4px;
                        border-radius: 4px;
                    ">×</button>
                </div>

                <div class="current-balance" style="
                    margin-bottom: 16px;
                    padding: 12px;
                    background: #f3f4f6;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <span style="font-size: 14px; color: #6b7280;">الرصيد الحالي: </span>
                    <span id="current-balance-display" style="font-weight: bold; font-size: 18px; color: #1f2937;">$0.00</span>
                </div>

                <div class="f9-section" style="margin-bottom: 24px;">
                    <button id="f9-xinp1-btn" style="
                        width: 100%;
                        padding: 12px 16px;
                        background: #16a34a;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        transition: background 0.2s;
                    ">إضافة قيمة xinp1 للرصيد</button>
                    <p style="
                        font-size: 12px;
                        color: #6b7280;
                        margin: 8px 0 0 0;
                        text-align: center;
                    ">اضغط Enter في أي مكان للإضافة السريعة (محمي من التكرار)</p>
                </div>

                <div class="f9-section" style="margin-bottom: 24px;">
                    <label style="
                        display: block;
                        font-size: 14px;
                        font-weight: 500;
                        color: #374151;
                        margin-bottom: 8px;
                    ">تعديل الرصيد</label>
                    <div style="display: flex; gap: 8px;">
                        <input
                            id="f9-adjust"
                            type="number"
                            step="0.01"
                            placeholder="أدخل المبلغ"
                            style="
                                flex: 1;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 6px;
                                outline: none;
                                font-size: 14px;
                            "
                        >
                        <button id="f9-add-adjust" style="
                            padding: 8px 12px;
                            background: #16a34a;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                            transition: background 0.2s;
                        ">+</button>
                        <button id="f9-sub-adjust" style="
                            padding: 8px 12px;
                            background: #dc2626;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                            transition: background 0.2s;
                        ">-</button>
                        <button id="f9-set-adjust" style="
                            padding: 8px 12px;
                            background: #2563eb;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                            transition: background 0.2s;
                        ">=</button>
                    </div>
                </div>

                <div style="
                    font-size: 12px;
                    color: #6b7280;
                    background: #f9fafb;
                    padding: 12px;
                    border-radius: 8px;
                    line-height: 1.4;
                ">
                    <p style="margin: 0 0 4px 0;">• اضغط F9 لإخفاء/إظهار النافذة</p>
                    <p style="margin: 0 0 4px 0;">• انقر على زر Chat لإظهار النافذة</p>
                    <p style="margin: 0 0 4px 0;">• اضغط Enter في أي مكان لإضافة قيمة xinp1 (محمي من التكرار)</p>
                    <p style="margin: 0 0 4px 0;">• الزر الأزرق (=) يقوم بتعديل الرصيد بالكامل</p>
                    <p style="margin: 0 0 4px 0;">• النقر على زر Bet سيخصم قيمة xinp1 تلقائياً</p>
                    <p style="margin: 0 0 4px 0;">• الفوز سيضيف الربح للرصيد تلقائياً</p>
                    <p style="margin: 0;">• يتم حفظ الرصيد تلقائياً عند مغادرة الصفحة</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(f9Window);
    setupF9Events();
}

// دالة الحصول على عنصر الرصيد
function getBalanceElement() {
    return document.querySelector('[data-testid="balance-toggle"] [data-testid="coin-toggle"] .wrap.truncate span.content span[data-ds-text="true"]');
}

// دالة استخراج القيمة الرقمية
function extractNumericValue(text) {
    const match = text.match(/\$?([\d,]+\.?\d*)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
}

// دالة تنسيق العملة
function formatCurrency(value) {
    return `$${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

// دالة تحديث الرصيد
function updateBalance(changeValue) {
    const element = getBalanceElement();
    if (!element) {
        console.log('لم يتم العثور على عنصر الرصيد');
        return;
    }

    const currentText = element.textContent || '';
    const currentValue = extractNumericValue(currentText);
    const newValue = currentValue + changeValue;

    element.textContent = formatCurrency(newValue);

    // تحديث العرض في النافذة
    const displayElement = document.getElementById('current-balance-display');
    if (displayElement) {
        displayElement.textContent = formatCurrency(newValue);
    }

    // حفظ الرصيد الجديد فوراً
    saveBalance();

    console.log(`تم تحديث الرصيد: ${formatCurrency(currentValue)} → ${formatCurrency(newValue)} (${changeValue > 0 ? '+' : ''}${changeValue})`);
}

// دالة تعديل الرصيد بالكامل (استبدال)
function setBalance(newValue) {
    const element = getBalanceElement();
    if (!element) {
        console.log('لم يتم العثور على عنصر الرصيد');
        return;
    }

    const currentText = element.textContent || '';
    const currentValue = extractNumericValue(currentText);

    element.textContent = formatCurrency(newValue);

    // تحديث العرض في النافذة
    const displayElement = document.getElementById('current-balance-display');
    if (displayElement) {
        displayElement.textContent = formatCurrency(newValue);
    }

    // حفظ الرصيد الجديد فوراً
    saveBalance();

    console.log(`تم تعديل الرصيد بالكامل: ${formatCurrency(currentValue)} → ${formatCurrency(newValue)}`);
}

// دالة إعداد أحداث النافذة
function setupF9Events() {
    const xinp1Btn = document.getElementById('f9-xinp1-btn');
    const adjustInput = document.getElementById('f9-adjust');
    const addAdjustBtn = document.getElementById('f9-add-adjust');
    const subAdjustBtn = document.getElementById('f9-sub-adjust');
    const setAdjustBtn = document.getElementById('f9-set-adjust');
    const closeBtn = document.querySelector('.f9-close');
    const overlay = document.querySelector('.f9-overlay');

    // تأثيرات hover للأزرار
    const buttons = [xinp1Btn, addAdjustBtn, subAdjustBtn, setAdjustBtn, closeBtn];
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.opacity = '0.8';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.opacity = '1';
        });
    });

    // إغلاق النافذة
    closeBtn.addEventListener('click', hideF9Window);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideF9Window();
    });

    // إضافة قيمة xinp1 (الزر الجديد)
    xinp1Btn.addEventListener('click', () => {
        addXinp1ToBalance();
    });

    // تعديل الرصيد
    addAdjustBtn.addEventListener('click', () => {
        const value = parseFloat(adjustInput.value);
        if (!isNaN(value) && value !== 0) {
            updateBalance(value);
            adjustInput.value = '';
            adjustInput.focus(); // إعادة التركيز
        }
    });

    subAdjustBtn.addEventListener('click', () => {
        const value = parseFloat(adjustInput.value);
        if (!isNaN(value) && value !== 0) {
            updateBalance(-value);
            adjustInput.value = '';
            adjustInput.focus(); // إعادة التركيز
        }
    });

    // تعديل الرصيد بالكامل (الزر الأزرق =)
    setAdjustBtn.addEventListener('click', () => {
        const value = parseFloat(adjustInput.value);
        if (!isNaN(value) && value >= 0) {
            setBalance(value);
            adjustInput.value = '';
            adjustInput.focus(); // إعادة التركيز
        }
    });

    // معالجة Enter في حقل التعديل
    adjustInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = parseFloat(adjustInput.value);
            if (!isNaN(value) && value !== 0) {
                updateBalance(value);
                adjustInput.value = '';
            }
        }
    });
}

// دالة إظهار النافذة
function showF9Window() {
    if (!f9Window) createF9Window();
    f9Window.style.display = 'block';
    f9WindowVisible = true;

    // تحديث الرصيد الحالي
    const element = getBalanceElement();
    if (element) {
        const currentValue = extractNumericValue(element.textContent || '');
        const displayElement = document.getElementById('current-balance-display');
        if (displayElement) {
            displayElement.textContent = formatCurrency(currentValue);
        }
    }

    // التركيز على حقل التعديل
    setTimeout(() => {
        const adjustInput = document.getElementById('f9-adjust');
        if (adjustInput) adjustInput.focus();
    }, 100);
}

// دالة إخفاء النافذة
function hideF9Window() {
    if (f9Window) {
        f9Window.style.display = 'none';
    }
    f9WindowVisible = false;
}

// دالة مراقبة زر Bet - محسنة لمنع الخصم المضاعف
function setupBetButtonMonitor() {
    // إزالة أي مستمعي أحداث سابقين
    document.removeEventListener('click', handleBetClick);

    // إضافة المستمع الجديد مع capture = true لتجنب التداخل
    document.addEventListener('click', handleBetClick, true);

    console.log('تم إعداد مراقبة زر Bet مع الحماية من الخصم المضاعف');
}

// دالة معالجة النقر على زر Bet - محسنة
function handleBetClick(e) {
    const betButton = e.target.closest('[data-testid="bet-button"]');

    if (!betButton) return;

    const currentTime = Date.now();

    // منع التنفيذ إذا تم تنفيذه مؤخراً (خلال الثانية الأخيرة)
    if (currentTime - lastBetTime < 1000 || betProcessed) {
        console.log('تم منع الخصم المضاعف - انتظار...');
        return;
    }

    // وضع علامة أنه تم التنفيذ
    betProcessed = true;
    lastBetTime = currentTime;

    // البحث عن حقل xinp1 في الواجهة الأساسية
    const xinp1 = document.getElementById('xinp1');

    if (xinp1 && xinp1.value) {
        const value = parseFloat(xinp1.value);

        if (!isNaN(value) && value > 0) {
            // خصم القيمة من الرصيد
            updateBalance(-value);
            console.log(`✓ تم خصم ${value} من الرصيد بواسطة زر Bet`);
        }
    }

    // إعادة تعيين العلامة بعد فترة قصيرة
    setTimeout(() => {
        betProcessed = false;
    }, 1500);
}

// دالة إعداد مستمع Enter العام المحسن - مع منع التكرار
function setupGlobalEnterListener() {
    // تجنب إضافة المستمع أكثر من مرة
    if (enterListenerAdded) {
        console.log('مستمع Enter العام موجود بالفعل');
        return;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;

            // تجاهل إذا كان التركيز على حقل التعديل في نافذة F9
            if (activeElement && activeElement.id === 'f9-adjust') {
                return; // دع حقل التعديل يتعامل مع Enter بطريقته
            }

            // تجاهل إذا كان التركيز على حقل xinp1 (لأنه يتعامل مع Enter داخلياً)
            if (activeElement && activeElement.id === 'xinp1') {
                return;
            }

            // تجاهل إذا كان المستخدم يكتب في حقل آخر
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                return;
            }

            // تنفيذ دالة إضافة xinp1 مع الحماية من التكرار
            addXinp1ToBalance();
        }
    });

    enterListenerAdded = true; // وضع علامة أن المستمع تم إضافته
    console.log('تم إعداد مستمع Enter العام لإضافة xinp1 مع الحماية من التكرار');
}

// مراقبة مفتاح F9
document.addEventListener('keydown', (e) => {
    if (e.key === 'F9') {
        e.preventDefault();
        if (f9WindowVisible) {
            hideF9Window();
        } else {
            showF9Window();
        }
    }
});

// إضافة مؤشر F9 في الزاوية
function addF9Indicator() {
    if (document.getElementById('f9-indicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'f9-indicator';
    indicator.innerHTML = ' ';
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #transparent;
        color: white;
        padding: 15px 15px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        z-index: 9999;
        opacity: 0.7;
        transition: opacity 0.2s;
        cursor: pointer;
        user-select: none;
    `;

    indicator.addEventListener('mouseenter', () => {
        indicator.style.opacity = '1';
    });

    indicator.addEventListener('mouseleave', () => {
        indicator.style.opacity = '0.7';
    });

    indicator.addEventListener('click', () => {
        if (f9WindowVisible) {
            hideF9Window();
        } else {
            showF9Window();
        }
    });

    document.body.appendChild(indicator);
}

// دالة تهيئة ميزات F9
function initF9Features() {
    setupBetButtonMonitor();
    setupGlobalEnterListener(); // إضافة مستمع Enter العام المحسن
    setupChatButtonMonitor(); // إضافة مراقبة زر Chat
    addF9Indicator();
    console.log('تم تفعيل ميزات F9 لتعديل الرصيد مع Enter العام المحمي من التكرار وزر Chat');
}

// دالة التهيئة الرئيسية
function init() {
    replaceElements();
    setupGameResultMonitor(); // إضافة مراقبة نافذة النتائج
    initF9Features(); // إضافة ميزات F9
    initBalanceSave(); // إضافة ميزة حفظ الرصيد
    pageObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    console.log('تم تهيئة السكريپت مع مراقبة نتائج اللعبة وميزات F9 المحسنة وحفظ الرصيد ومنع التكرار المحسن وزر Chat');
}

// تشغيل السكريپت
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

setTimeout(init, 1000);

})();
