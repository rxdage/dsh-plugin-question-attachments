/**
 * dsh-plugin-question-attachments — client half (hand-written factory-CJS, no build step).
 *
 * DEBUG BUILD: the overlay always renders a small status pill so a missing chip can
 * be told apart from "plugin never mounted" and from "no pending interaction".
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
    var DEBUG = false;

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

    function pillStyle(color) {
      return {
        pointerEvents: "auto",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "999px",
        border: "1px solid " + color,
        background: "rgba(30,31,34,0.94)",
        color: "#eaeaea",
        font: "11px/16px system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif",
        cursor: "pointer",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        userSelect: "none"
      };
    }

    function noteStyle() {
      return {
        pointerEvents: "auto",
        maxWidth: "340px",
        padding: "4px 10px",
        borderRadius: "8px",
        background: "rgba(30,31,34,0.94)",
        color: "#c9c9c9",
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

      if (!DEBUG && (!sessionId || !pending)) return null;

      var label;
      var color;
      if (!sessionId) {
        label = "QA 调试：无会话";
        color = "rgba(255,170,60,0.6)";
      } else if (!pending) {
        label = "QA 调试：" + sessionId.slice(0, 8) + " 无提问";
        color = "rgba(160,160,160,0.5)";
      } else {
        label = busy ? "上传中…" : "📎 附图 / 文件";
        color = "rgba(120,200,255,0.6)";
      }

      return h(
        "div",
        {
          style: {
            position: "fixed",
            right: "20px",
            bottom: "128px",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "6px"
          }
        },
        note !== null ? h("div", { style: noteStyle() }, note) : null,
        h(
          "button",
          {
            type: "button",
            title: "把图片/文件发给我：点这里选择，或直接粘贴、拖进来",
            style: pillStyle(color),
            onClick: function () {
              if (busy) return;
              if (sessionId && pending && inputRef.current) inputRef.current.click();
            },
            onDragOver: function (event) {
              event.preventDefault();
            },
            onDrop: function (event) {
              event.preventDefault();
              var dropped = filesOf(event.dataTransfer ? event.dataTransfer.files : null);
              if (dropped.length > 0) sendRef.current(dropped);
            }
          },
          label
        ),
        h("input", {
          ref: inputRef,
          type: "file",
          multiple: true,
          style: { display: "none" },
          onChange: function (event) {
            var files = filesOf(event.target ? event.target.files : null);
            if (event.target) event.target.value = "";
            if (files.length > 0) sendRef.current(files);
          }
        })
      );
    }

    /** Register the overlay contribution. */
    function apply(ctx) {
      var slots = ctx.get("slots");
      if (!slots || typeof slots.inject !== "function") return;
      var sessions = ctx.get("sessions");
      var uiSession = ctx.get("uiSession");
      function register(component) {
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
            component
          );
        });
      }
      try {
        ctx.effect(function () {
          return register(Chip);
        }, ID + ": question attachments overlay");
      } catch (error) {
        try {
          slots.inject("shell.overlay", function () {
            return slots.register(
              { name: "shell.overlay", id: ID + "-error", order: 401 },
              function ErrorPill() {
                return h("div", { style: pillStyle("rgba(255,80,80,0.7)") }, "QA 错误：" + (error && error.message ? error.message : String(error)));
              }
            );
          });
        } catch (nested) {
          /* nothing left to report with */
        }
      }
    }

    exports.name = ID;
    exports.apply = apply;
    exports.inject = ["slots", "sessions", "uiSession"];
    return module.exports;
  }
});
