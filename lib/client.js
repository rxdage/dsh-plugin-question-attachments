/**
 * dsh-plugin-question-attachments — client half (hand-written factory-CJS, no build step).
 *
 * Registers one `shell.overlay` contribution: a floating "attach" chip that only
 * appears while the current Session has a pending interaction (the
 * ask_user_question card owns the composer position). Picking, pasting or
 * dropping a file uploads it through `ctx.fileUpload` for that Session and sends
 * it to the agent as a steering prompt, so the model receives the image/file at
 * the next step boundary — together with the answer the user submits.
 *
 * Nothing here changes the answer protocol: the question card still answers with
 * text, the attachment arrives as a queued user message.
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
    var CHIP_BOTTOM = "128px";

    function snapshotOf(store) {
      try {
        return store && typeof store.getSnapshot === "function" ? store.getSnapshot() : undefined;
      } catch (error) {
        return undefined;
      }
    }

    /**
     * Session whose ownership includes a pending interaction, i.e. the one whose
     * composer is currently replaced by a question/approval card.
     */
    function pendingSessionId(sessions, uiSession) {
      var list = snapshotOf(sessions && sessions.list);
      var id = list && typeof list.current === "string" ? list.current : undefined;
      if (typeof id !== "string" || id === "") return null;
      var status = snapshotOf(uiSession && uiSession.sessionStatus);
      var entry = status instanceof Map ? status.get(id) : undefined;
      var pending = entry ? entry.pendingInteraction : undefined;
      if (!pending) {
        var interactions = snapshotOf(uiSession && uiSession.pendingInteractions);
        if (interactions instanceof Map) pending = interactions.get(id);
      }
      return pending ? id : null;
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

    function chipStyle(busy) {
      return {
        pointerEvents: "auto",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "999px",
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(30,31,34,0.94)",
        color: "#eaeaea",
        font: "12px/18px system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif",
        cursor: busy ? "progress" : "pointer",
        opacity: busy ? 0.75 : 1,
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

    /**
     * Floating chip bound to the Session services.
     * @param props - sessions/uiSession services plus a lazy fileUpload accessor.
     */
    function AttachChip(props) {
      var sessions = props.sessions;
      var uiSession = props.uiSession;
      var getUpload = props.getUpload;
      var sessionState = React.useState(null);
      var sessionId = sessionState[0];
      var setSessionId = sessionState[1];
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
          try {
            setSessionId(pendingSessionId(sessions, uiSession));
          } catch (error) {
            setSessionId(null);
          }
        }
        var offs = [];
        try {
          if (sessions && sessions.list && typeof sessions.list.subscribe === "function") offs.push(sessions.list.subscribe(update));
          if (uiSession && uiSession.sessionStatus && typeof uiSession.sessionStatus.subscribe === "function") offs.push(uiSession.sessionStatus.subscribe(update));
          if (uiSession && uiSession.pendingInteractions && typeof uiSession.pendingInteractions.subscribe === "function") offs.push(uiSession.pendingInteractions.subscribe(update));
        } catch (error) {
          /* keep whichever subscriptions were installed */
        }
        update();
        return function () {
          for (var index = 0; index < offs.length; index += 1) {
            try {
              offs[index]();
            } catch (error) {
              /* ignore unsubscribe failures */
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
        var sid = sessionId;
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

      if (typeof sessionId !== "string" || sessionId === "") return null;

      return h(
        "div",
        {
          style: {
            position: "fixed",
            right: "20px",
            bottom: CHIP_BOTTOM,
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
            style: chipStyle(busy),
            onClick: function () {
              if (busy) return;
              if (inputRef.current) inputRef.current.click();
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
          busy ? "上传中…" : "📎 附图 / 文件"
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
      if (!slots) return;
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
            AttachChip
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
