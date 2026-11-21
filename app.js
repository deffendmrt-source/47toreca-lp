// 買取価格表の読み込み（prices/manifest.json）と、本日の営業案内
(function () {
  "use strict";

  var X_URL = "https://x.com/47toreca_ku";
  var WEEK = "日月火水木金土";

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text) e.textContent = text;
    return e;
  }

  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return "";
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return m[1] + "年" + (+m[2]) + "月" + (+m[3]) + "日（" + WEEK.charAt(d.getDay()) + "）";
  }

  // 取得日時（ISO・+09:00）を日本時間の「YYYY年M月D日 HH:MM」で返す
  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var p = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
    return p.year + "年" + p.month + "月" + p.day + "日 " + p.hour + ":" + p.minute;
  }

  function updatedText(t) {
    if (!t.date) return "";
    var s = t.updated_at ? fmtDateTime(t.updated_at) : fmtDate(t.date);
    return s ? "最終更新：" + s : "";
  }

  function renderTable(t, v) {
    var box = el("div", { role: "tabpanel", id: "panel-" + t.id, "aria-labelledby": "tab-" + t.id });
    if (!t.images || !t.images.length) {
      var empty = el("div", { "class": "empty" });
      empty.appendChild(el("p", {}, t.label + "の買取表は準備中です。"));
      empty.appendChild(el("p", {}, "最新の買取情報は公式Xでご案内しています。"));
      var a = el("a", { "class": "btn", href: X_URL, target: "_blank", rel: "noopener" }, "公式Xを見る");
      empty.appendChild(a);
      box.appendChild(empty);
      return box;
    }
    t.images.forEach(function (src, i) {
      var url = src + "?v=" + encodeURIComponent(v);
      var fig = el("figure");
      var link = el("a", { href: url, target: "_blank", rel: "noopener", "aria-label": t.label + "の買取表（" + (i + 1) + "枚目）を大きく開く" });
      var img = el("img", {
        src: url,
        alt: t.label + " 買取価格表" + (t.images.length > 1 ? "（" + (i + 1) + "/" + t.images.length + "）" : ""),
        loading: i === 0 ? "eager" : "lazy",
        decoding: "async"
      });
      link.appendChild(img);
      fig.appendChild(link);
      box.appendChild(fig);
    });
    return box;
  }

  function show(tables, id, v) {
    var t = tables.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    document.querySelectorAll(".tab").forEach(function (b) {
      b.setAttribute("aria-selected", b.dataset.id === id ? "true" : "false");
      b.tabIndex = b.dataset.id === id ? 0 : -1;
    });
    var host = document.getElementById("tables");
    host.replaceChildren(renderTable(t, v));
    document.getElementById("updated").textContent = updatedText(t);
  }

  function init(m) {
    // 画像のない（未生成の）表のタブは出さない。すべて空のときだけ「準備中」表示のために全タブを残す
    var all = m.tables || [];
    var tables = all.filter(function (t) { return t.images && t.images.length; });
    if (!tables.length) tables = all;
    var v = m.generated_at || "";
    var tabs = document.getElementById("tabs");
    tabs.replaceChildren();
    tables.forEach(function (t) {
      var b = el("button", { "class": "tab", role: "tab", id: "tab-" + t.id, "aria-controls": "panel-" + t.id, type: "button" }, t.label);
      b.dataset.id = t.id;
      b.addEventListener("click", function () { show(tables, t.id, v); });
      b.addEventListener("keydown", function (e) {
        var ids = tables.map(function (x) { return x.id; });
        var i = ids.indexOf(t.id);
        if (e.key === "ArrowRight") i = (i + 1) % ids.length;
        else if (e.key === "ArrowLeft") i = (i + ids.length - 1) % ids.length;
        else return;
        show(tables, ids[i], v);
        document.getElementById("tab-" + ids[i]).focus();
      });
      tabs.appendChild(b);
    });
    // 初期表示: 画像のある最初のタブ
    var first = tables.filter(function (t) { return t.images && t.images.length; })[0] || tables[0];
    if (first) show(tables, first.id, v);
  }

  function failed() {
    var host = document.getElementById("tables");
    var box = el("div", { "class": "empty" });
    box.appendChild(el("p", {}, "買取表を読み込めませんでした。"));
    box.appendChild(el("a", { "class": "btn", href: X_URL, target: "_blank", rel: "noopener" }, "公式Xで最新の買取表を見る"));
    host.replaceChildren(box);
  }

  fetch("prices/manifest.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(failed);

  // 本日の営業案内（月・火・水は定休日ではなく通常営業日。木〜日は不定期のためXで案内）
  (function today() {
    var wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(new Date());
    var e = document.getElementById("today");
    if (!e) return;
    if (wd === "Mon" || wd === "Tue" || wd === "Wed") {
      e.textContent = "本日は通常営業日です（17:30〜20:00）※祝日は公式Xをご確認ください";
    } else {
      e.textContent = "本日の営業有無は公式Xでご確認ください";
    }
    e.hidden = false;
  })();
})();
