function parseQueryString(query) {
	return new URLSearchParams(query);
}

function hide(element) {
	element?.setAttribute("hidden", "true");
}

function hideToolbarGroup(group) {
	hide(group);
	group?.classList.add("hidden");
}

function createGotoPageController(app) {
	if (window.GGnomePDFViewer?.gotoPage) {
		return window.GGnomePDFViewer;
	}

	let pendingPage = NaN;
	let pendingUntil = 0;
	let timer = null;

	function stopTimer() {
		if (timer) {
			window.clearInterval(timer);
			timer = null;
		}
	}

	function tryApplyPendingPage() {
		if (!app.initialized || !app.pdfDocument || !app.pdfViewer || app.pagesCount <= 0) {
			return false;
		}
		if (!Number.isFinite(pendingPage) || pendingPage <= 0) {
			return false;
		}
		if (app.page !== pendingPage) {
			app.page = pendingPage;
			return false;
		}
		if (Date.now() >= pendingUntil) {
			pendingPage = NaN;
			pendingUntil = 0;
			return true;
		}
		return false;
	}

	function ensurePendingPage() {
		if (timer) {
			return;
		}
		let tries = 0;
		timer = window.setInterval(() => {
			tries++;
			if (!Number.isFinite(pendingPage) || pendingPage <= 0) {
				stopTimer();
				pendingUntil = 0;
				return;
			}
			tryApplyPendingPage();
			if (!Number.isFinite(pendingPage) || tries > 80) {
				stopTimer();
				pendingUntil = 0;
			}
		}, 100);
	}

	const api = {
		gotoPage(page) {
			const targetPage = Number(page);
			if (!Number.isFinite(targetPage) || targetPage <= 0) {
				return false;
			}
			window.frameElement?.setAttribute("data-ggnome-goto-page", String(targetPage));
			pendingPage = targetPage;
			pendingUntil = Date.now() + 1200;
			ensurePendingPage();
			tryApplyPendingPage();
			return true;
		}
	};

	window.addEventListener("load", () => {
		if (Number.isFinite(pendingPage) && pendingPage > 0) {
			pendingUntil = Date.now() + 1200;
			ensurePendingPage();
		}
	});

	window.GGnomePDFViewer = api;
	app.gotoPage = api.gotoPage;
	const initialPage = Number(window.frameElement?.getAttribute("data-ggnome-goto-page"));
	if (Number.isFinite(initialPage) && initialPage > 0) {
		api.gotoPage(initialPage);
	}
	return api;
}

function installGGnomeViewerPatch() {
	const app = window.PDFViewerApplication;
	if (!app || typeof app.run !== "function") {
		return false;
	}
	if (app.__ggnomeRunPatched) {
		createGotoPageController(app);
		return true;
	}
	app.__ggnomeRunPatched = true;

	const originalRun = app.run.bind(app);
	app.run = async function patchedRun(config) {
		const params = parseQueryString(document.location.search.substring(1));
		const toolbar = params.get("toolbar") ?? "true";
		const sidebar = params.get("sidebar") ?? "true";
		const textSearch = params.get("textsearch") ?? "true";
		const fullscreen = params.get("fullscreen") ?? "true";
		const printing = params.get("printing") ?? "true";
		const download = params.get("download") ?? "true";
		const tools = params.get("tools") ?? "true";
		const enableLinks = params.get("enablelinks") ?? "true";

		if (toolbar === "true") {
			if (sidebar === "false") {
				hide(config.viewsManager?.toggleButton);
			}
			if (textSearch === "false") {
				hide(config.findBar?.toggleButton);
			}
			if (fullscreen === "false") {
				hide(config.secondaryToolbar?.presentationModeButton);
			}
			if (printing === "false") {
				hide(config.toolbar?.print);
				hide(config.secondaryToolbar?.printButton);
			}
			if (download === "false") {
				hide(config.toolbar?.download);
				hide(config.secondaryToolbar?.downloadButton);
			}
			if (tools === "false") {
				hide(config.secondaryToolbar?.toggleButton);
			}

			hide(config.secondaryToolbar?.openFileButton);
			hide(config.secondaryToolbar?.viewBookmarkButton);
			hide(document.getElementById("viewBookmarkSeparator"));
			hide(config.secondaryToolbar?.documentPropertiesButton);
		} else {
			hideToolbarGroup(config.toolbar?.container);
			document.documentElement.style.setProperty("--toolbar-height", "0px");
		}

		hide(config.viewsManager?.layersButton);
		hide(config.toolbar?.editorCommentButton);
		hide(config.toolbar?.editorCommentParamsToolbar);
		hide(config.toolbar?.editorFreeTextButton);
		hide(config.toolbar?.editorFreeTextParamsToolbar);
		hide(config.toolbar?.editorHighlightButton);
		hide(config.toolbar?.editorHighlightParamsToolbar);
		hide(config.toolbar?.editorInkButton);
		hide(config.toolbar?.editorInkParamsToolbar);
		hide(config.toolbar?.editorStampButton);
		hide(config.toolbar?.editorStampParamsToolbar);
		hide(config.toolbar?.editorSignatureButton);
		hide(config.toolbar?.editorSignatureParamsToolbar);

		await originalRun(config);

		createGotoPageController(app);
		app.pdfLinkService.externalLinkTarget = window.PDFViewerApplicationConstants.LinkTarget.BLANK;
		if (enableLinks === "false") {
			app.pdfLinkService.externalLinkEnabled = false;
		}
	};

	return true;
}

function applyGGnomeViewerPatch() {
	if (installGGnomeViewerPatch()) {
		return;
	}
	window.setTimeout(applyGGnomeViewerPatch, 0);
}

document.addEventListener("webviewerloaded", applyGGnomeViewerPatch, {
	once: true
});
try {
	parent.document.addEventListener("webviewerloaded", applyGGnomeViewerPatch, {
		once: true
	});
} catch (_error) {}
applyGGnomeViewerPatch();
