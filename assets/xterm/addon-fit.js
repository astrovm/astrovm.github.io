!(function (e, t) {
  "object" == typeof exports && "object" == typeof module
    ? (module.exports = t())
    : "function" == typeof define && define.amd
    ? define([], t)
    : "object" == typeof exports
    ? (exports.FitAddon = t())
    : (e.FitAddon = t());
})(self, () =>
  (() => {
    "use strict";
    var e = {};
    return (
      (() => {
        var t = e;
        Object.defineProperty(t, "__esModule", { value: !0 }),
          (t.FitAddon = void 0),
          (t.FitAddon = class {
            activate(e) {
              this._terminal = e;
            }
            dispose() {}
            fit(options = {}) {
              const e = this.proposeDimensions(options);
              if (!e || !this._terminal || isNaN(e.cols) || isNaN(e.rows))
                return;
              const t = this._terminal._core;
              (this._terminal.rows === e.rows &&
                this._terminal.cols === e.cols) ||
                (t._renderService.clear(),
                this._terminal.resize(e.cols, e.rows));
            }
            proposeDimensions({
              scrollbarWidth = 0,
              sizePercent = 0.96,
              isMaximized = false,
            } = {}) {
              if (!this._terminal) return;
              if (!this._terminal.element) return;

              const e = this._terminal._core,
                t = e._renderService.dimensions;
              if (0 === t.css.cell.width || 0 === t.css.cell.height) return;

              // Calculate minimum dimensions based on 80x24
              const minCols = 80;
              const minRows = 24;

              // Get viewport size (use provided percent only when not maximized)
              const viewWidth =
                document.documentElement.clientWidth * sizePercent;
              const viewHeight =
                document.documentElement.clientHeight * sizePercent;

              // Calculate dimensions based on viewport size
              const maxCols = Math.floor(
                (viewWidth - scrollbarWidth) / t.css.cell.width
              );
              const maxRows = Math.floor((viewHeight - 24) / t.css.cell.height);

              // When maximized use full size, otherwise use minimum between calculated and standard size
              const cols = isMaximized ? maxCols : Math.min(minCols, maxCols);
              const rows = isMaximized ? maxRows : Math.min(minRows, maxRows);

              return { cols, rows };
            }
          });
      })(),
      e
    );
  })()
);
