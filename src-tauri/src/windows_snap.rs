/*---------------------------------------------------------------------------------------------
 *  Windows 11 Native Snap Layouts Integration for Custom Titlebar
 *--------------------------------------------------------------------------------------------*/

#[cfg(target_os = "windows")]
pub mod win_snap {
    use std::sync::atomic::{AtomicI32, Ordering};
    use windows_sys::Win32::Foundation::{FALSE, HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    // Default titlebar height (35px) and control button width (46px) matching titlebarPart.ts
    static TITLEBAR_HEIGHT: AtomicI32 = AtomicI32::new(35);
    static CONTROL_WIDTH: AtomicI32 = AtomicI32::new(46);

    static mut OLD_WND_PROC: WNDPROC = None;

    pub fn setup_snap_layouts(raw_hwnd: isize) {
        if raw_hwnd == 0 {
            return;
        }

        unsafe {
            let hwnd = raw_hwnd as HWND;

            // 1. Set WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_THICKFRAME, WS_CAPTION on Win32 window
            // Windows 11 DWM checks WS_MAXIMIZEBOX and WS_THICKFRAME to decide whether to enable Snap Layouts hover!
            let current_style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            let new_style = current_style | WS_MAXIMIZEBOX | WS_MINIMIZEBOX | WS_THICKFRAME | WS_CAPTION;
            SetWindowLongPtrW(hwnd, GWL_STYLE, new_style as isize);

            // 2. Subclass window procedure via GWLP_WNDPROC
            let old_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, snap_wnd_proc as *const () as usize as isize);
            if old_proc != 0 {
                OLD_WND_PROC = std::mem::transmute(old_proc);
            }

            // 3. Trigger frame update
            SetWindowPos(
                hwnd,
                0 as _,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
            );
        }
    }

    unsafe extern "system" fn snap_wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_NCCALCSIZE => {
                // When wparam is TRUE (1), returning 0 suppresses native window caption/border rendering
                // while preserving native window framing, snap behavior, and resize borders!
                if wparam != 0 {
                    return 0;
                }
                CallWindowProcW(OLD_WND_PROC, hwnd, msg, wparam, lparam)
            }
            WM_NCHITTEST => {
                let default_res = CallWindowProcW(OLD_WND_PROC, hwnd, msg, wparam, lparam);

                // Unpack loword (x) and hiword (y) screen coordinates (signed for multi-monitor setups)
                let x = (lparam as u32 & 0xffff) as i16 as i32;
                let y = ((lparam as u32 >> 16) & 0xffff) as i16 as i32;

                let mut rect = RECT {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                };
                if GetWindowRect(hwnd, &mut rect) == FALSE {
                    return default_res;
                }

                let win_width = rect.right - rect.left;
                let win_height = rect.bottom - rect.top;

                let rel_x = x - rect.left;
                let rel_y = y - rect.top;

                let is_maximized = IsZoomed(hwnd) != FALSE;
                let resize_border = if is_maximized { 0 } else { 6 };
                let titlebar_h = TITLEBAR_HEIGHT.load(Ordering::Relaxed);
                let btn_w = CONTROL_WIDTH.load(Ordering::Relaxed);

                // Handle window edge resizes if window is not maximized
                if !is_maximized {
                    if rel_y < resize_border {
                        if rel_x < resize_border * 2 {
                            return HTTOPLEFT as LRESULT;
                        }
                        if rel_x > win_width - (resize_border * 2) {
                            return HTTOPRIGHT as LRESULT;
                        }
                        return HTTOP as LRESULT;
                    }
                    if rel_y > win_height - resize_border {
                        if rel_x < resize_border * 2 {
                            return HTBOTTOMLEFT as LRESULT;
                        }
                        if rel_x > win_width - (resize_border * 2) {
                            return HTBOTTOMRIGHT as LRESULT;
                        }
                        return HTBOTTOM as LRESULT;
                    }
                    if rel_x < resize_border {
                        return HTLEFT as LRESULT;
                    }
                    if rel_x > win_width - resize_border {
                        return HTRIGHT as LRESULT;
                    }
                }

                // Handle title bar & window control hit testing
                if rel_y >= 0 && rel_y < titlebar_h {
                    // Close button: [win_width - btn_w, win_width]
                    if rel_x >= win_width - btn_w && rel_x <= win_width {
                        return HTCLOSE as LRESULT;
                    }

                    // Maximize / Restore button: [win_width - 2*btn_w, win_width - btn_w]
                    if rel_x >= win_width - (btn_w * 2) && rel_x < win_width - btn_w {
                        // Returning HTMAXBUTTON triggers native Windows 11 Snap Layouts hover popup!
                        // Windows automatically checks if user enabled Snap Layouts in Windows Settings.
                        return HTMAXBUTTON as LRESULT;
                    }

                    // Minimize button: [win_width - 3*btn_w, win_width - 2*btn_w]
                    if rel_x >= win_width - (btn_w * 3) && rel_x < win_width - (btn_w * 2) {
                        return HTMINBUTTON as LRESULT;
                    }

                    // Title bar drag area
                    return HTCAPTION as LRESULT;
                }

                default_res
            }
            _ => CallWindowProcW(OLD_WND_PROC, hwnd, msg, wparam, lparam),
        }
    }
}
