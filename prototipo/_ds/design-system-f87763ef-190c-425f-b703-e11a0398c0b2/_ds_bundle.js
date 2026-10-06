/* @ds-bundle: {"namespace":"CambalacheUI","components":[{"name":"Avatar","sourcePath":"components/general/Avatar/Avatar.jsx"},{"name":"Badge","sourcePath":"components/general/Badge/Badge.jsx"},{"name":"Button","sourcePath":"components/general/Button/Button.jsx"},{"name":"Card","sourcePath":"components/general/Card/Card.jsx"},{"name":"Checkbox","sourcePath":"components/general/Checkbox/Checkbox.jsx"},{"name":"Input","sourcePath":"components/general/Input/Input.jsx"},{"name":"Modal","sourcePath":"components/general/Modal/Modal.jsx"},{"name":"Select","sourcePath":"components/general/Select/Select.jsx"},{"name":"StatCard","sourcePath":"components/general/StatCard/StatCard.jsx"},{"name":"Table","sourcePath":"components/general/Table/Table.jsx"},{"name":"Tabs","sourcePath":"components/general/Tabs/Tabs.jsx"},{"name":"Textarea","sourcePath":"components/general/Textarea/Textarea.jsx"},{"name":"Toggle","sourcePath":"components/general/Toggle/Toggle.jsx"},{"name":"Tooltip","sourcePath":"components/general/Tooltip/Tooltip.jsx"}],"sourceHashes":{"components/general/Avatar/Avatar.jsx":"877881efce4e","components/general/Avatar/Avatar.d.ts":"e3d4bc0ee6bb","components/general/Avatar/Avatar.prompt.md":"bde85f552080","components/general/Badge/Badge.jsx":"a8b272b3374d","components/general/Badge/Badge.d.ts":"65e851b57562","components/general/Badge/Badge.prompt.md":"e67bc56ce7e5","components/general/Button/Button.jsx":"26cbffb85268","components/general/Button/Button.d.ts":"3a86b6b9cb48","components/general/Button/Button.prompt.md":"a6a9a80ac096","components/general/Card/Card.jsx":"dd6bba613ff7","components/general/Card/Card.d.ts":"4dde879df1be","components/general/Card/Card.prompt.md":"cc9327e8b259","components/general/Checkbox/Checkbox.jsx":"72a4d16e7d89","components/general/Checkbox/Checkbox.d.ts":"b098b5488b1d","components/general/Checkbox/Checkbox.prompt.md":"1707f8418bfc","components/general/Input/Input.jsx":"46ac64503593","components/general/Input/Input.d.ts":"24e954c658ff","components/general/Input/Input.prompt.md":"e90c820eccf5","components/general/Modal/Modal.jsx":"1f76daf2414c","components/general/Modal/Modal.d.ts":"5cbab6c54cf3","components/general/Modal/Modal.prompt.md":"cc879c24d87c","components/general/Select/Select.jsx":"e1c1bdaa340d","components/general/Select/Select.d.ts":"69b9f5ba5d06","components/general/Select/Select.prompt.md":"7e5b3332aec3","components/general/StatCard/StatCard.jsx":"aa10f69b70e4","components/general/StatCard/StatCard.d.ts":"6a5711a98efc","components/general/StatCard/StatCard.prompt.md":"d682612da5eb","components/general/Table/Table.jsx":"22e20554e30d","components/general/Table/Table.d.ts":"75343c21e7b5","components/general/Table/Table.prompt.md":"ff4401c30a84","components/general/Tabs/Tabs.jsx":"ef9bf46da5b4","components/general/Tabs/Tabs.d.ts":"7d5814b8f90e","components/general/Tabs/Tabs.prompt.md":"3da663a8209b","components/general/Textarea/Textarea.jsx":"91af86288976","components/general/Textarea/Textarea.d.ts":"bc7c54e99ef2","components/general/Textarea/Textarea.prompt.md":"d3e11a5bec95","components/general/Toggle/Toggle.jsx":"0bc17199f79c","components/general/Toggle/Toggle.d.ts":"11184b532a2e","components/general/Toggle/Toggle.prompt.md":"b90c11efb868","components/general/Tooltip/Tooltip.jsx":"1c004f053ec6","components/general/Tooltip/Tooltip.d.ts":"b3a9da4ed6bc","components/general/Tooltip/Tooltip.prompt.md":"12c0c3f15795"},"inlinedExternals":[],"builtBy":"cc-design-sync"} */
"use strict";
var CambalacheUI = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx2(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs2(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx2;
      module.exports.jsxs = jsxs2;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs2 : jsx2)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // design-system/dist/index.js
  var index_exports = {};
  __export(index_exports, {
    Avatar: () => Avatar,
    Badge: () => Badge,
    Button: () => Button,
    Card: () => Card,
    Checkbox: () => Checkbox,
    Input: () => Input,
    Modal: () => Modal,
    Select: () => Select,
    StatCard: () => StatCard,
    Table: () => Table,
    Tabs: () => Tabs,
    Textarea: () => Textarea,
    Toggle: () => Toggle,
    Tooltip: () => Tooltip
  });
  init_define_import_meta_env();
  var import_jsx_runtime = __toESM(require_react_shim(), 1);
  var React = __toESM(require_react_shim(), 1);
  function cn(...parts) {
    return parts.filter(Boolean).join(" ");
  }
  function Button({
    variant = "primary",
    size = "md",
    block = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    type = "button",
    ...rest
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type,
        className: cn("cbl-btn", `cbl-btn--${variant}`, `cbl-btn--${size}`, block && "cbl-btn--block", className),
        ...rest,
        children: [
          leadingIcon,
          children,
          trailingIcon
        ]
      }
    );
  }
  function Input({ label, required, hint, error, className, id, ...rest }) {
    const inputId = id ?? (label ? `cbl-input-${label.replace(/\s+/g, "-").toLowerCase()}` : void 0);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cbl-field", children: [
      label && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "cbl-label", htmlFor: inputId, children: [
        label,
        required && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-label__req", children: "*" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          id: inputId,
          className: cn("cbl-input", error && "cbl-input--error", className),
          "aria-invalid": error ? true : void 0,
          ...rest
        }
      ),
      error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-hint cbl-hint--error", children: error }) : hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-hint", children: hint }) : null
    ] });
  }
  function Textarea({ label, required, hint, error, className, id, rows = 4, ...rest }) {
    const areaId = id ?? (label ? `cbl-textarea-${label.replace(/\s+/g, "-").toLowerCase()}` : void 0);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cbl-field", children: [
      label && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "cbl-label", htmlFor: areaId, children: [
        label,
        required && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-label__req", children: "*" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          id: areaId,
          rows,
          className: cn("cbl-textarea", error && "cbl-textarea--error", className),
          "aria-invalid": error ? true : void 0,
          ...rest
        }
      ),
      error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-hint cbl-hint--error", children: error }) : hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-hint", children: hint }) : null
    ] });
  }
  function Select({ label, required, hint, error, options, className, id, children, ...rest }) {
    const selId = id ?? (label ? `cbl-select-${label.replace(/\s+/g, "-").toLowerCase()}` : void 0);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cbl-field", children: [
      label && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "cbl-label", htmlFor: selId, children: [
        label,
        required && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-label__req", children: "*" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "select",
        {
          id: selId,
          className: cn("cbl-select", error && "cbl-select--error", className),
          "aria-invalid": error ? true : void 0,
          ...rest,
          children: options ? options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: o.value, children: o.label }, o.value)) : children
        }
      ),
      error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-hint cbl-hint--error", children: error }) : hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-hint", children: hint }) : null
    ] });
  }
  function Badge({ tone = "neutral", dot = false, className, children, ...rest }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: cn("cbl-badge", `cbl-badge--${tone}`, className), ...rest, children: [
      dot && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-badge__dot" }),
      children
    ] });
  }
  function Card({ title, subtitle, footer, hoverable, flushBody, className, children, ...rest }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cn("cbl-card", hoverable && "cbl-card--hover", className), ...rest, children: [
      (title || subtitle) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cbl-card__header", children: [
        title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "cbl-card__title", children: title }),
        subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "cbl-card__subtitle", children: subtitle })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: flushBody ? void 0 : "cbl-card__body", children }),
      footer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cbl-card__footer", children: footer })
    ] });
  }
  function Modal({ open = true, title, onClose, footer, children, maxWidth, className }) {
    if (!open) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cbl-modal__overlay", onClick: onClose, role: "presentation", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        className: cn("cbl-modal", className),
        style: maxWidth ? { maxWidth } : void 0,
        role: "dialog",
        "aria-modal": "true",
        onClick: (e) => e.stopPropagation(),
        children: [
          (title || onClose) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cbl-modal__header", children: [
            title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "cbl-modal__title", children: title }),
            onClose && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "cbl-modal__close", "aria-label": "Cerrar", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 6 6 18M6 6l12 12" }) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cbl-modal__body", children }),
          footer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cbl-modal__footer", children: footer })
        ]
      }
    ) });
  }
  function StatCard({ label, value, delta, deltaDirection = "up", deltaNote, icon, className, ...rest }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cn("cbl-stat", className), ...rest, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cbl-stat__top", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-stat__label", children: label }),
        icon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-stat__icon", children: icon })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-stat__value", children: value }),
      (delta || deltaNote) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "cbl-stat__delta-row", children: [
        delta && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: cn("cbl-stat__delta", deltaDirection === "up" ? "cbl-stat__delta--up" : "cbl-stat__delta--down"), children: [
          deltaDirection === "up" ? "\u25B2" : "\u25BC",
          " ",
          delta
        ] }),
        deltaNote && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "cbl-stat__delta-note", children: [
          " ",
          deltaNote
        ] })
      ] })
    ] });
  }
  function Tabs({ items, defaultValue, value, onValueChange, className }) {
    const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value);
    const active = value ?? internal;
    function select(v) {
      if (value === void 0) setInternal(v);
      onValueChange?.(v);
    }
    const activeItem = items.find((i) => i.value === active);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cn("cbl-tabs", className), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cbl-tabs__list", role: "tablist", children: items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": i.value === active,
          className: cn("cbl-tabs__tab", i.value === active && "cbl-tabs__tab--active"),
          onClick: () => select(i.value),
          children: i.label
        },
        i.value
      )) }),
      activeItem?.content !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cbl-tabs__panel", role: "tabpanel", children: activeItem.content })
    ] });
  }
  function Table({ columns, data, hover = true, bordered = true, className }) {
    const table = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: cn("cbl-table", hover && "cbl-table--hover", className), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: columns.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: c.align ? { textAlign: c.align } : void 0, children: c.header }, c.key)) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: data.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: columns.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: c.align ? { textAlign: c.align } : void 0, children: row[c.key] }, c.key)) }, i)) })
    ] });
    return bordered ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cbl-table__wrap", children: table }) : table;
  }
  function initials(name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  }
  function Avatar({ name, src, size = "md", className, ...rest }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("cbl-avatar", `cbl-avatar--${size}`, className), title: name, ...rest, children: src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { className: "cbl-avatar__img", src, alt: name }) : initials(name) });
  }
  function Checkbox({ checked = false, label, disabled = false, onChange, className }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "label",
      {
        className: cn("cbl-checkbox", checked && "cbl-checkbox--checked", disabled && "cbl-checkbox--disabled", className),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked,
              disabled,
              onChange: (e) => onChange?.(e.target.checked),
              style: { position: "absolute", opacity: 0, width: 0, height: 0 }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-checkbox__box", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 6 9 17l-5-5" }) }) }),
          label && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })
        ]
      }
    );
  }
  function Toggle({ checked = false, label, disabled = false, onChange, className }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: cn("cbl-toggle", checked && "cbl-toggle--on", disabled && "cbl-toggle--disabled", className), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          role: "switch",
          "aria-checked": checked,
          disabled,
          className: "cbl-toggle__track",
          onClick: () => onChange?.(!checked),
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-toggle__thumb" })
        }
      ),
      label && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })
    ] });
  }
  function Tooltip({ label, open, children, className }) {
    const [hovered, setHovered] = React.useState(false);
    const visible = open ?? hovered;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "span",
      {
        className: cn("cbl-tooltip", className),
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        children: [
          children,
          visible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cbl-tooltip__bubble", role: "tooltip", children: label })
        ]
      }
    );
  }
  return __toCommonJS(index_exports);
})();
window.CambalacheUI=CambalacheUI.__dsMainNs?Object.assign({},CambalacheUI,CambalacheUI.__dsMainNs,{__dsMainNs:undefined}):CambalacheUI;
