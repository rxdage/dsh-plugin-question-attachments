/**
 * dsh-plugin-question-attachments — client half (hand-written factory-CJS, no build step).
 *
 * Registers one `shell.overlay` contribution: an attach button pinned to the right
 * end of the free-text answer row while the ask_user_question card owns the
 * composer. Picking, pasting or dropping a file uploads it through
 * `ctx.fileUpload` for the current Session and sends it to the agent as a
 * steering prompt, so the model receives the attachment at the next step
 * boundary — together with the answer the user submits.
 *
 * Sent attachments are shown as Codex-style cards above the answer field: the
 * plugin reserves that space with a temporary top margin on the field's card
 * container, so the row grows instead of being covered.
 */
window.__ModuleLoader__.load({
  id: "dsh-plugin-question-attachments",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var React = require("react");
    var h = React.createElement;

    var ID = "dsh-plugin-question-attachments";
    var STRIP_HEIGHT = 50;

    function snapshotOf(store) {
      try {
        return store && typeof store.getSnapshot === "function" ? store.getSnapshot() : undefined;
      } catch (error) {
        return undefined;
      }
    }

    /** Current Session id: the uiSession main binding, else the retained mainView row. */
    function currentSessionId(sessions, uiSession) {
      try {
        var source = uiSession && uiSession.adapter && uiSession.adapter.current;
        var binding = snapshotOf(source);
        if (binding && typeof binding.sessionId === "string" && binding.sessionId !== "") return binding.sessionId;
      } catch (error) {
        /* fall through */
      }
      try {
        var list = snapshotOf(sessions && sessions.list);
        var byId = list && list.byId;
        if (!byId) return null;
        var ids = Object.keys(byId);
        for (var index = 0; index < ids.length; index += 1) {
          var row = byId[ids[index]];
          if (row && row.retainedBy && (row.retainedBy.mainView || 0) > 0) return ids[index];
        }
      } catch (error) {
        /* ignore */
      }
      return null;
    }

    function pendingOf(uiSession, sessionId) {
      try {
        var status = snapshotOf(uiSession && uiSession.sessionStatus);
        var entry = status instanceof Map ? status.get(sessionId) : undefined;
        if (entry && entry.pendingInteraction) return entry.pendingInteraction;
      } catch (error) {
        /* ignore */
      }
      try {
        var map = snapshotOf(uiSession && uiSession.pendingInteractions);
        if (map instanceof Map && map.has(sessionId)) return map.get(sessionId);
      } catch (error) {
        /* ignore */
      }
      return null;
    }

    function filesOf(list) {
      var files = [];
      if (!list) return files;
      for (var index = 0; index < list.length; index += 1) {
        var file = list[index];
        if (file && typeof file === "object") files.push(file);
      }
      return files;
    }

    function visibleField(node) {
      if (!node) return false;
      var box = node.getBoundingClientRect();
      return box.width >= 60 && box.height >= 12;
    }

    /** The visible free-text answer field of the question card, if any. */
    function findAnswerInput() {
      try {
        var direct = document.querySelector('[class*="fieldInput"]');
        if (visibleField(direct)) return direct;
      } catch (error) {
        /* fall through */
      }
      var nodes = document.querySelectorAll('textarea, input[type="text"], input:not([type])');
      var fallback = null;
      for (var index = 0; index < nodes.length; index += 1) {
        var node = nodes[index];
        if (!visibleField(node)) continue;
        var placeholder = node.getAttribute("placeholder") || "";
        if (/答案|回答|输入|answer/i.test(placeholder)) return node;
        fallback = node;
      }
      return fallback;
    }

    /** The card container that owns the answer field (the element to push down). */
    function answerContainerOf(field) {
      if (!field) return null;
      try {
        return field.closest('[class*="customBlock"]') || field.closest('[class*="customInline"]') || field.parentElement;
      } catch (error) {
        return field.parentElement;
      }
    }

    function buttonStyle(busy) {
      return {
        pointerEvents: "auto",
        width: "28px",
        height: "28px",
        display: "grid",
        placeItems: "center",
        padding: "0",
        borderRadius: "8px",
        border: "1px solid var(--dsw-alias-border-l4, rgba(255,255,255,0.22))",
        background: "var(--dsw-alias-bg-module-platform, rgba(30,31,34,0.9))",
        color: "var(--dsw-alias-label-secondary, #cfcfcf)",
        font: "13px/1 system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif",
        cursor: busy ? "progress" : "pointer",
        opacity: busy ? 0.65 : 1,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        userSelect: "none"
      };
    }

    function noteStyle() {
      return {
        pointerEvents: "none",
        position: "absolute",
        right: "0",
        bottom: "34px",
        maxWidth: "320px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        padding: "4px 8px",
        borderRadius: "6px",
        background: "rgba(30,31,34,0.96)",
        color: "#d6d6d6",
        font: "11px/16px system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
      };
    }

    function cardStyle() {
      return {
        pointerEvents: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: "190px",
        padding: "5px 10px",
        borderRadius: "10px",
        border: "1px solid var(--dsw-alias-border-l4, rgba(255,255,255,0.18))",
        background: "var(--dsw-alias-bg-module-platform, rgba(32,33,36,0.96))",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)"
      };
    }

    function iconStyle() {
      return {
        flex: "none",
        width: "26px",
        height: "26px",
        borderRadius: "7px",
        background: "rgba(255,255,255,0.06)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        fontSize: "13px",
        color: "var(--dsw-alias-label-secondary, #cfcfcf)"
      };
    }

    function textStyle() {
      return {
        minWidth: "0",
        display: "flex",
        flexDirection: "column",
        lineHeight: "14px"
      };
    }

    function nameStyle() {
      return {
        fontSize: "11px",
        color: "var(--dsw-alias-label-primary, #eaeaea)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      };
    }

    function kindStyle() {
      return {
        fontSize: "10px",
        color: "var(--dsw-alias-label-tertiary, #9a9a9a)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      };
    }

    function Chip(props) {
      var sessions = props.sessions;
      var uiSession = props.uiSession;
      var getUpload = props.getUpload;
      var ref = React.useRef({ sessionId: null, pending: null });
      var versionState = React.useState(0);
      var bump = versionState[1];
      var rectState = React.useState(null);
      var rect = rectState[0];
      var setRect = rectState[1];
      var noteState = React.useState(null);
      var note = noteState[0];
      var setNote = noteState[1];
      var busyState = React.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];
      var sentState = React.useState([]);
      var sent = sentState[0];
      var setSent = sentState[1];
      var inputRef = React.useRef(null);
      var sendRef = React.useRef(null);
      var urlsRef = React.useRef([]);

      React.useEffect(function () {
        return function () {
          for (var index = 0; index < urlsRef.current.length; index += 1) {
            try {
              URL.revokeObjectURL(urlsRef.current[index]);
            } catch (error) {
              /* ignore */
            }
          }
          urlsRef.current = [];
        };
      }, []);

      // A new question card starts with an empty strip.
      React.useEffect(function () {
        if (ref.current.pending === null && sent.length > 0) setSent([]);
      });

      React.useEffect(function () {
        function update() {
          var sessionId = currentSessionId(sessions, uiSession);
          ref.current = { sessionId: sessionId, pending: sessionId ? pendingOf(uiSession, sessionId) : null };
          bump(function (value) { return value + 1; });
        }
        var offs = [];
        try {
          var cs = uiSession && uiSession.adapter && uiSession.adapter.current;
          if (cs && typeof cs.subscribe === "function") offs.push(cs.subscribe(update));
          if (sessions && sessions.list && typeof sessions.list.subscribe === "function") offs.push(sessions.list.subscribe(update));
          if (uiSession && uiSession.sessionStatus && typeof uiSession.sessionStatus.subscribe === "function") offs.push(uiSession.sessionStatus.subscribe(update));
          if (uiSession && uiSession.pendingInteractions && typeof uiSession.pendingInteractions.subscribe === "function") offs.push(uiSession.pendingInteractions.subscribe(update));
        } catch (error) {
          /* keep installed subscriptions */
        }
        update();
        return function () {
          for (var index = 0; index < offs.length; index += 1) {
            try {
              offs[index]();
            } catch (error) {
              /* ignore */
            }
          }
        };
      }, []);

      // Keep the button glued to the answer row while the card is mounted.
      React.useEffect(function () {
        var timer = 0;
        var last = "";
        function tick() {
          var el = ref.current.pending ? findAnswerInput() : null;
          if (el) {
            var box = el.getBoundingClientRect();
            var next = { left: Math.round(box.right - 36), top: Math.round(box.top + 4) };
            var key = next.left + ":" + next.top;
            if (key !== last) {
              last = key;
              setRect(next);
            }
          } else if (last !== "none") {
            last = "none";
            setRect(null);
          }
          timer = window.setTimeout(tick, 200);
        }
        tick();
        return function () {
          window.clearTimeout(timer);
        };
      }, []);

      // Reserve room above the answer field for the sent-attachment cards.
      React.useEffect(function () {
        var field = findAnswerInput();
        var container = answerContainerOf(field);
        if (!container) return undefined;
        if (sent.length > 0) {
          if (container.getAttribute("data-qa-margin") === null) {
            container.setAttribute("data-qa-margin", container.style.marginTop || "");
          }
          container.style.marginTop = STRIP_HEIGHT + "px";
        } else if (container.getAttribute("data-qa-margin") !== null) {
          container.style.marginTop = container.getAttribute("data-qa-margin") || "";
          container.removeAttribute("data-qa-margin");
        }
        return function () {
          if (container.getAttribute("data-qa-margin") !== null) {
            container.style.marginTop = container.getAttribute("data-qa-margin") || "";
            container.removeAttribute("data-qa-margin");
          }
        };
      }, [sent.length, rect === null]);

      React.useEffect(function () {
        function onPaste(event) {
          var clipboard = event.clipboardData;
          if (!clipboard || !clipboard.files || clipboard.files.length === 0) return;
          var files = filesOf(clipboard.files);
          if (files.length === 0) return;
          if (typeof sendRef.current !== "function") return;
          event.preventDefault();
          sendRef.current(files);
        }
        document.addEventListener("paste", onPaste, true);
        return function () {
          document.removeEventListener("paste", onPaste, true);
        };
      }, []);

      async function send(files) {
        var sid = ref.current.sessionId;
        if (typeof sid !== "string" || sid === "") {
          setNote("当前没有可发送的会话");
          return;
        }
        var upload = typeof getUpload === "function" ? getUpload() : undefined;
        if (!upload) {
          setNote("上传服务不可用");
          return;
        }
        setBusy(true);
        try {
          for (var index = 0; index < files.length; index += 1) {
            var file = files[index];
            var name = typeof file.name === "string" && file.name !== "" ? file.name : "未命名文件";
            var mediaType = typeof file.type === "string" ? file.type : "";
            var isImage = mediaType.indexOf("image/") === 0;
            setNote("上传中：" + name + " …");
            var result = isImage
              ? await upload.uploadImage(sid, file, mediaType, name)
              : await upload.upload(sid, file, name);
            if (!result || result.ok !== true) {
              var reason = result && result.error ? result.error.message || result.error.code : "上传失败";
              throw new Error(reason);
            }
            var binding = typeof sessions.binding === "function" ? sessions.binding(sid) : undefined;
            var session = binding ? binding.session : undefined;
            if (!session) throw new Error("会话尚未就绪，请稍后再试");
            var sentResult = await session.prompt(
              [
                { type: "file", receiptId: result.value.receiptId },
                { type: "text", text: "附图：" + name }
              ],
              "steer"
            );
            if (!sentResult || sentResult.ok !== true) {
              var failure = sentResult && sentResult.error ? sentResult.error.message || sentResult.error.code : "发送失败";
              throw new Error(failure);
            }
            var thumb = null;
            try {
              if (isImage) {
                thumb = URL.createObjectURL(file);
                urlsRef.current.push(thumb);
              }
            } catch (error) {
              /* preview only */
            }
            var extension = name.indexOf(".") >= 0 ? name.slice(name.lastIndexOf(".") + 1).toUpperCase() : "文件";
            setSent(function (list) {
              return list.concat([{ key: sid + ":" + Date.now() + ":" + index, name: name, thumb: thumb, kind: isImage ? "图片" : extension }]);
            });
            setNote(null);
          }
        } catch (error) {
          setNote("失败：" + (error && error.message ? error.message : String(error)));
        } finally {
          setBusy(false);
        }
      }
      sendRef.current = send;

      var sessionId = ref.current.sessionId;
      var pending = ref.current.pending;

      function renderStrip(position) {
        if (sent.length === 0) return null;
        var items = sent.slice(0, 3).map(function (item) {
          return h(
            "div",
            { key: item.key, style: cardStyle(), title: item.name + "（已发送）" },
            h(
              "div",
              { style: iconStyle() },
              item.thumb !== null
                ? h("img", { src: item.thumb, style: { width: "26px", height: "26px", objectFit: "cover", display: "block" } })
                : "📎"
            ),
            h(
              "div",
              { style: textStyle() },
              h("span", { style: nameStyle() }, item.name.length > 18 ? item.name.slice(0, 17) + "…" : item.name),
              h("span", { style: kindStyle() }, item.kind + " · 已发送")
            )
          );
        });
        if (sent.length > 3) {
          items.push(
            h("div", { key: "more", style: cardStyle() }, h("div", { style: iconStyle() }, "…"), h("div", { style: textStyle() }, h("span", { style: nameStyle() }, "+" + (sent.length - 3)), h("span", { style: kindStyle() }, "更多")))
          );
        }
        return h(
          "div",
          {
            style: Object.assign(
              {
                position: "fixed",
                zIndex: 70,
                display: "flex",
                gap: "6px",
                alignItems: "flex-end",
                pointerEvents: "none",
                maxWidth: "520px",
                overflow: "hidden"
              },
              position
            )
          },
          items
        );
      }

      if (!sessionId || !pending) return null;

      var button = h(
        "button",
        {
          type: "button",
          title: "附图 / 文件：点这里选择，也可以直接粘贴或拖到这里",
          style: buttonStyle(busy),
          onClick: function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (busy) return;
            if (inputRef.current) inputRef.current.click();
          },
          onMouseDown: function (event) {
            event.preventDefault();
            event.stopPropagation();
          },
          onDragOver: function (event) {
            event.preventDefault();
            event.stopPropagation();
          },
          onDrop: function (event) {
            event.preventDefault();
            event.stopPropagation();
            var dropped = filesOf(event.dataTransfer ? event.dataTransfer.files : null);
            if (dropped.length > 0) sendRef.current(dropped);
          }
        },
        busy ? "…" : "📎"
      );

      var picker = h("input", {
        ref: inputRef,
        type: "file",
        multiple: true,
        style: { display: "none" },
        onChange: function (event) {
          var files = filesOf(event.target ? event.target.files : null);
          if (event.target) event.target.value = "";
          if (files.length > 0) sendRef.current(files);
        }
      });

      if (rect !== null) {
        return h(
          "div",
          {
            style: {
              position: "fixed",
              left: rect.left + "px",
              top: rect.top + "px",
              zIndex: 70,
              pointerEvents: "none",
              display: "flex",
              alignItems: "flex-start"
            }
          },
          note !== null ? h("div", { style: noteStyle() }, note) : null,
          renderStrip({ left: rect.left + "px", top: rect.top - 40 + "px", maxWidth: Math.max(200, Math.round(rect.right - rect.left) - 8) + "px" }),
          button,
          picker
        );
      }

      return h(
        "div",
        {
          style: {
            position: "fixed",
            right: "20px",
            bottom: "128px",
            zIndex: 70,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "6px"
          }
        },
        note !== null ? h("div", { style: noteStyle() }, note) : null,
        renderStrip({ right: "20px", bottom: "162px" }),
        button,
        picker
      );
    }

    /** Register the overlay contribution. */
    function apply(ctx) {
      var slots = ctx.get("slots");
      if (!slots || typeof slots.inject !== "function") return;
      var sessions = ctx.get("sessions");
      var uiSession = ctx.get("uiSession");
      ctx.effect(function () {
        return slots.inject("shell.overlay", function () {
          return slots.register(
            {
              name: "shell.overlay",
              id: ID,
              order: 400,
              inject: function () {
                return {
                  sessions: sessions,
                  uiSession: uiSession,
                  getUpload: function () {
                    return ctx.get("fileUpload");
                  }
                };
              }
            },
            Chip
          );
        });
      }, ID + ": question attachments overlay");
    }

    exports.name = ID;
    exports.apply = apply;
    exports.inject = ["slots", "sessions", "uiSession"];
    return module.exports;
  }
});
