// ==UserScript==
// @name         GitHub: Mark All Notifications Done
// @namespace    https://github.com/mandrean/github-mark-all-done
// @version      1.0.0
// @description  Adds a "Mark all as done" button to GitHub notification groups, marking all notifications including hidden/paginated ones
// @author       mandrean
// @match        https://github.com/*
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/mandrean/github-mark-all-done
// @supportURL   https://github.com/mandrean/github-mark-all-done/issues
// ==/UserScript==

(function () {
	'use strict';

	// --- Constants ---

	const BUTTON_CLASS = 'gm-mark-all-done';
	const BUTTON_SELECTOR = '.' + BUTTON_CLASS;
	const SEEN_ATTR = 'data-gm-seen';

	// Octicon SVGs (from GitHub's icon set)
	const CHECK_CIRCLE_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" class="octicon mr-1" aria-hidden="true"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm1.5 0a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm10.28-1.72-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l1.47 1.47 3.97-3.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/></svg>';
	const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" class="octicon" aria-hidden="true"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>';
	const STOP_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" class="octicon" aria-hidden="true"><path fill="currentColor" d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>';
	const SPINNER_SVG = '<svg viewBox="0 0 32 32" width="18" height="18" class="gm-toast-spinner"><path fill="#959da5" d="M16 0 A16 16 0 0 0 16 32 A16 16 0 0 0 16 0 M16 4 A12 12 0 0 1 16 28 A12 12 0 0 1 16 4"/><path fill="#ffffff" d="M16 0 A16 16 0 0 1 32 16 L28 16 A12 12 0 0 0 16 4z"/></svg>';

	// --- Styles ---

	function injectStyles() {
		if (document.querySelector('#gm-mark-all-done-styles')) return;
		const style = document.createElement('style');
		style.id = 'gm-mark-all-done-styles';
		style.textContent = `
			@keyframes gm-toast-in {
				from { opacity: 0; transform: translateY(100%); }
				to   { opacity: 1; transform: translateY(0); }
			}
			@keyframes gm-toast-out {
				from { opacity: 1; transform: translateY(0); }
				to   { opacity: 0; transform: translateY(100%); }
			}
			@keyframes gm-spinner-rotate {
				to { transform: rotate(360deg); }
			}
			.gm-toast-in  { animation: gm-toast-in 0.24s ease-out forwards; }
			.gm-toast-out { animation: gm-toast-out 0.24s ease-in forwards; }
			.gm-toast-spinner { animation: gm-spinner-rotate 1s linear infinite; }
		`;
		document.head.append(style);
	}

	// --- Utilities ---

	function delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	async function fetchDom(url) {
		const response = await fetch(url, {
			headers: { 'Accept': 'text/html,application/xhtml+xml' },
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		if (response.url.includes('/login') || response.url.includes('/sessions')) {
			throw new Error('Authentication required — please log in to GitHub');
		}
		const html = await response.text();
		return new DOMParser().parseFromString(html, 'text/html');
	}

	// --- Toast ---

	async function showToast(taskFn, { message = 'Processing…', doneMessage = 'Done.' } = {}) {
		injectStyles();

		const iconSpan = document.createElement('span');
		iconSpan.className = 'Toast-icon';
		iconSpan.innerHTML = SPINNER_SVG;

		const msgSpan = document.createElement('span');
		msgSpan.textContent = message;

		const label = document.createElement('div');
		label.style.cssText = 'font-size:10px;color:silver;margin-bottom:-0.3em';
		label.textContent = 'GitHub Mark All Done';

		const content = document.createElement('span');
		content.className = 'Toast-content py-2';
		content.append(label, msgSpan);

		const toast = document.createElement('div');
		toast.setAttribute('role', 'log');
		toast.style.zIndex = '101';
		toast.className = 'position-fixed bottom-0 right-0 ml-5 mb-5 Toast Toast--loading gm-toast-in';
		toast.append(iconSpan, content);

		document.body.append(toast);
		await delay(30);

		let lastMessage = message;
		const updateMessage = (text) => {
			lastMessage = text;
			msgSpan.textContent = text;
		};

		let finalMessage = 'Unknown error';
		try {
			await taskFn(updateMessage);
			toast.classList.replace('Toast--loading', 'Toast--success');
			finalMessage = doneMessage === false ? lastMessage : doneMessage;
			iconSpan.innerHTML = CHECK_SVG;
		} catch (error) {
			toast.classList.replace('Toast--loading', 'Toast--error');
			finalMessage = error.message || 'An error occurred';
			iconSpan.innerHTML = STOP_SVG;
		}

		updateMessage(finalMessage);

		const displayTime = (String(finalMessage).split(' ').length * 300) + 2000;
		await delay(displayTime);

		toast.classList.replace('gm-toast-in', 'gm-toast-out');
		toast.addEventListener('animationend', () => toast.remove(), { once: true });
	}

	// --- MutationObserver helper ---

	function observeSelector(selector, callback) {
		for (const el of document.querySelectorAll(selector)) {
			if (!el.hasAttribute(SEEN_ATTR)) {
				el.setAttribute(SEEN_ATTR, '1');
				callback(el);
			}
		}

		const observer = new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node.nodeType !== Node.ELEMENT_NODE) continue;
					const targets = node.matches?.(selector) ? [node] : node.querySelectorAll?.(selector) ?? [];
					for (const el of targets) {
						if (!el.hasAttribute(SEEN_ATTR)) {
							el.setAttribute(SEEN_ATTR, '1');
							callback(el);
						}
					}
				}
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return observer;
	}

	// --- Core logic ---

	function findViewAllLink(group) {
		for (const link of group.querySelectorAll('a[href^="/notifications?query="]')) {
			if (link.textContent?.trim().startsWith('View all')) {
				return link;
			}
		}
		return undefined;
	}

	async function markNotificationDone(notification) {
		const doneButton = notification.querySelector('[aria-label="Done"]');
		if (!doneButton) throw new Error('Done button not found');
		const form = doneButton.closest('form');
		if (!form) throw new Error('Form not found for Done button');

		const action = new URL(form.getAttribute('action'), location.origin).href;
		const method = (form.getAttribute('method') || 'POST').toUpperCase();

		const params = new URLSearchParams();
		for (const input of form.querySelectorAll('input[name]')) {
			params.append(input.getAttribute('name'), input.getAttribute('value') || '');
		}

		const response = await fetch(action, {
			method,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: params.toString(),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		if (response.url.includes('/login') || response.url.includes('/sessions')) {
			throw new Error('Authentication required — please log in to GitHub');
		}
	}

	async function handleMarkAllDone(button) {
		button.disabled = true;
		const group = button.closest('.js-notifications-group');
		const viewAllLink = findViewAllLink(group);
		if (!viewAllLink) {
			button.disabled = false;
			return;
		}

		let successes = 0;
		let failures = 0;

		await showToast(async (progress) => {
			let url = viewAllLink.href;

			while (url) {
				let page;
				try {
					page = await fetchDom(url);
				} catch {
					failures++;
					break;
				}

				const notifications = page.querySelectorAll('.notifications-list-item');
				for (const notification of notifications) {
					try {
						await markNotificationDone(notification);
						successes++;
					} catch {
						failures++;
					}
					progress('Marking as done: ' + (successes + failures) + '…');
					await delay(100);
				}

				const nextLink = page.querySelector('a[aria-label="Next"]');
				const nextHref = nextLink?.getAttribute('href');
				url = nextHref ? new URL(nextHref, location.origin).href : undefined;
			}

			if (successes > 0 && failures === 0) {
				group.remove();
			} else {
				button.disabled = false;
			}

			progress(
				failures > 0
					? successes + ' notifications marked as done (' + failures + ' failed)'
					: successes + ' notifications marked as done'
			);
		}, {
			message: 'Marking all notifications as done…',
			doneMessage: false,
		});
	}

	// --- UI ---

	function addMarkAllDoneButton(markReadButton) {
		const group = markReadButton.closest('.js-notifications-group');
		if (!group || !findViewAllLink(group)) return;

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn btn-sm ml-2 tooltipped tooltipped-w ' + BUTTON_CLASS;
		btn.setAttribute('aria-label', 'Mark all notifications in this repository as done, including hidden ones');
		btn.innerHTML = CHECK_CIRCLE_SVG + ' Mark all as done';
		markReadButton.after(btn);
	}

	// --- Lifecycle ---

	let currentObserver = null;

	// Event delegation (registered once, works across navigations)
	document.addEventListener('click', (event) => {
		const button = event.target.closest(BUTTON_SELECTOR);
		if (button) handleMarkAllDone(button);
	});

	function init() {
		if (currentObserver) {
			currentObserver.disconnect();
			currentObserver = null;
		}
		if (!location.pathname.startsWith('/notifications')) return;

		currentObserver = observeSelector(
			'.js-grouped-notifications-mark-all-read-button',
			addMarkAllDoneButton,
		);
	}

	init();
	document.addEventListener('turbo:render', init);
})();
