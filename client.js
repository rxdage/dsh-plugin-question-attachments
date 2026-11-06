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
 * The button follows the answer textarea's live rect (the card keeps that row
 * pinned while its body scrolls); when no textarea is on screen (other pending
 * cards) it falls back to a floating button in the bottom-right corner.
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

    /** The visible free-text answer field of the question card, if any. */
    function findAnswerInput() {
      var nodes = document.querySelectorAll("textarea");
      var fallback = null;
      for (var index = 0; index < nodes.length; index += 1) {
        var node = nodes[index];
        var rect = node.getBoundingClientRect();
        if (rect.width < 60 || rect.height < 12) continue;
        var placeholder = node.getAttribute("placeholder") || "";
        if (/答案|回答|输入|answer/i.test(placeholder)) return node;
        fallback = node;
      }
      return fallback;
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
      var inputRef = React.useRef(null);
      var sendRef = React.useRef(null);

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
            var next = {
              left: Math.round(box.right - 36),
              top: Math.round(box.top + 4)
            };
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
            setNote("上传中：" + name + " …");
            var result = mediaType.indexOf("image/") === 0
              ? await upload.uploadImage(sid, file, mediaType, name)
              : await upload.upload(sid, file, name);
            if (!result || result.ok !== true) {
              var reason = result && result.error ? result.error.message || result.error.code : "上传失败";
              throw new Error(reason);
            }
            var binding = typeof sessions.binding === "function" ? sessions.binding(sid) : undefined;
            var session = binding ? binding.session : undefined;
            if (!session) throw new Error("会话尚未就绪，请稍后再试");
            var sent = await session.prompt(
              [
                { type: "file", receiptId: result.value.receiptId },
                { type: "text", text: "附图：" + name }
              ],
              "steer"
            );
            if (!sent || sent.ok !== true) {
              var failure = sent && sent.error ? sent.error.message || sent.error.code : "发送失败";
              throw new Error(failure);
            }
            setNote("已发送：" + name + "（作答后我就能看到）");
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

      // Pinned to the answer field's right end, inside the card.
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
          button,
          picker
        );
      }

      // Fallback for cards without a visible answer field.
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
