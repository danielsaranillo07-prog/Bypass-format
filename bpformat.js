// --- Configuration ---
const els = {
    libName: document.getElementById('libName'),
    hexPatch: document.getElementById('hexPatch'),
    input: document.getElementById('input'),
    results: document.getElementById('results-area'),
    globalActions: document.getElementById('globalActions'),
    toast: document.getElementById('toast')
};

let fullOutputText = "";

// --- Bypass Types ---
const bypassTypes = [{
    id: 'encoff',
    title: 'EncOff Format',
    ext: 'txt',
    gen: (o) => {
        let s = ["/* ===== EncOff FORMAT ===== */"];
        o.forEach(x => s.push(`EncOff(0x${x.toString(16).toUpperCase()}),`));
        return s.join('\n');
    }
}, {
    id: 'bypass_offsets',
    title: 'Bypass Offsets',
    ext: 'cpp',
    gen: (o) => {
        let s = ["/* ===== BYPASS OFFSETS ===== */"];
        o.forEach((x, i) => s.push(`inline uintptr_t bypass${i+1} = 0x${x.toString(16).toUpperCase()};`));
        return s.join('\n');
    }
}, {
    id: 'direct_patch',
    title: 'Direct Memory Patch',
    ext: 'cpp',
    gen: (o, lib, pat) => {
        let s = ["/* ===== DIRECT MEMORY PATCH ===== */"];
        o.forEach(x => s.push(`MemoryPatch::createWithHex("${lib}", 0x${x.toString(16).toUpperCase()}, "${pat}").Modify();`));
        return s.join('\n');
    }
}, {
    id: 'armfalse_patch',
    title: 'ArmFalse Patch',
    ext: 'cpp',
    gen: (o, lib) => {
        let s = ["/* ===== BYPASS MEMORY PATCH (armFalse) ===== */"];
        for (let i = 0; i < o.length; i++) s.push(`MemoryPatch::createWithHex(OBFUSCATE("${lib}"), bypass${i+1}, armFalse).Modify();`);
        return s.join('\n');
    }
}, {
    id: 'tools_hook',
    title: 'Tools::Hook Calls',
    ext: 'cpp',
    gen: (o, lib) => {
        let s = ["/* ===== TOOLS::HOOK CALLS ===== */"];
        o.forEach(x => s.push(`Tools::Hook((void*)getAbsoluteAddress(OBFUSCATE("${lib}"), 0x${x.toString(16).toUpperCase()}), (void*)hook_bypass, (void**)&orig_bypass);`));
        return s.join('\n');
    }
}, {
    id: 'dobby_hook',
    title: 'Dobby Hook Calls',
    ext: 'cpp',
    gen: (o, lib) => {
        let s = ["/* ===== DOBBY HOOK CALLS ===== */"];
        o.forEach(x => s.push(`DobbyHook((void*)getAbsoluteAddress(OBFUSCATE("${lib}"), 0x${x.toString(16).toUpperCase()}), (void*)hook_bypass, (void**)&orig_bypass);`));
        return s.join('\n');
    }
}, {
    id: 'hook_lib',
    title: 'Hook Lib Format',
    ext: 'cpp',
    gen: (o, lib) => {
        let s = ["/* ===== HOOK_LIB FORMAT ===== */"];
        o.forEach(x => s.push(`HOOK_LIB("${lib}", "0x${x.toString(16).toUpperCase()}", h_disabled, o_disabled);`));
        return s.join('\n');
    }
}, {
    id: 'hexpatch_injector',
    title: 'HexPatch (Injector)',
    ext: 'lua',
    gen: (o, lib, pat) => {
        let s = ["/* ===== HEXPATCH (INJECTOR) ===== */"];
        o.forEach(x => s.push(`HexPatches.MemoryPatch("${lib}", 0x${x.toString(16).toUpperCase()}, "${pat}", 32);`));
        return s.join('\n');
    }
}];

// --- Functions ---

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        els.input.value = text;
        showToast("Pasted from clipboard");
    } catch (e) {
        showToast("Could not paste automatically", "error");
    }
}

function generate() {
    const raw = els.input.value.trim();
    if (!raw) return showToast("Please enter offsets first", "error");

    const lib = els.libName.value.trim() || "libanogs.so";
    const pat = els.hexPatch.value.trim() || "00 00";

    // Parse
    const offsets = raw.split('\n')
        .map(l => l.trim())
        .filter(l => l)
        .map(l => {
            if (!l.toLowerCase().startsWith("0x")) l = "0x" + l;
            return parseInt(l, 16);
        })
        .filter(n => !isNaN(n));

    if (offsets.length === 0) return showToast("No valid offsets found", "error");

    // Reset
    els.results.innerHTML = '';
    fullOutputText = "// ========================================\n//  SLAYER-BYPASS-FORMATTER | GENERATED\n// ========================================\n\n";

    // Generate Cards
    bypassTypes.forEach(type => {
        const content = type.gen(offsets, lib, pat);
        fullOutputText += content + "\n\n";

        // Create Card Elements
        const card = document.createElement('div');
        card.className = 'result-card';

        // Header
        const header = document.createElement('div');
        header.className = 'result-header';
        header.innerHTML = `<span class="result-title">${type.title}</span>`;

        // Preview
        const preview = document.createElement('div');
        preview.className = 'code-preview';
        preview.textContent = content; // Safe text insertion

        // Hidden Storage for Download Logic (Fixes the "Others can't download" issue)
        const hiddenStore = document.createElement('textarea');
        hiddenStore.className = 'hidden';
        hiddenStore.value = content;

        // Actions
        const actions = document.createElement('div');
        actions.className = 'result-actions';

        const btnCopy = document.createElement('button');
        btnCopy.className = 'btn-tonal';
        btnCopy.textContent = 'Copy';
        btnCopy.onclick = () => {
            navigator.clipboard.writeText(content);
            showToast("Copied!");
        };

        const btnSave = document.createElement('button');
        btnSave.className = 'btn-tonal';
        btnSave.textContent = `Save .${type.ext}`;
        // Pass the element reference to the download function
        btnSave.onclick = () => downloadFile(hiddenStore.value, `${type.id}.${type.ext}`);

        actions.appendChild(btnCopy);
        actions.appendChild(btnSave);

        // Assemble
        card.appendChild(header);
        card.appendChild(preview);
        card.appendChild(hiddenStore); // Hidden
        card.appendChild(actions);
        els.results.appendChild(card);
    });

    els.results.classList.add('active');
    els.globalActions.classList.add('visible');
    showToast("Generated successfully!");
}

function copyAll() {
    if (!fullOutputText) return;
    navigator.clipboard.writeText(fullOutputText).then(() => showToast("All output copied!"));
}

function saveAll() {
    if (!fullOutputText) return;
    downloadFile(fullOutputText, "full_bypass_output.txt");
}

// Robust Download Function
function downloadFile(content, filename) {
    const blob = new Blob([content], {
        type: "text/plain"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
}

function showToast(msg, type = 'normal') {
    const t = els.toast;
    t.textContent = msg;
    t.style.backgroundColor = type === 'error' ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}