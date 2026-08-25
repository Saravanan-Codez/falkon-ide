/*---------------------------------------------------------------------------------------------
 *  Windows 11 Native Snap Layouts Integration
 *  Works alongside native OS title bar (decorations: true in tauri.conf.json)
 *--------------------------------------------------------------------------------------------*/

#[cfg(target_os = "windows")]
pub mod win_snap {
    use windows_sys::Win32::Foundation::{FALSE, HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    static mut OLD_WND_PROC: WNDPROC = None;

    pub fn setup_snap_layouts(raw_hwnd: isize) {
        if raw_hwnd == 0 {
            return;
        }

        unsafe {
            let hwnd = raw_hwnd as HWND;

            // Subclass the window procedure ONLY to intercept WM_NCHITTEST.
            // We return HTMAXBUTTON when the cursor is over the native maximize
            // button area, which causes Windows 11 to show the Snap Layouts popup.
            //
            // We intentionally do NOT handle WM_NCCALCSIZE — that message is what
            // the old custom-titlebar code used to suppress the native caption bar.
            // Passing it through to DefWindowProc is exactly what makes the native
            // title bar (Minimize / Maximize / Close) appear correctly.
            let old_proc = SetWindowLongPtrW(
                hwnd,
                GWLP_WNDPROC,
                snap_wnd_proc as *const () as usize as isize,
            );
            if old_proc != 0 {
                OLD_WND_PROC = std::mem::transmute(old_proc);
            }
        }
    }

    unsafe extern "system" fn snap_wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if msg == WM_NCHITTEST {
            // Let Windows compute the default hit-test result first.
            // This correctly identifies HTCAPTION, HTMINBUTTON, HTMAXBUTTON,
            // HTCLOSE, HTLEFT/RIGHT/TOP/BOTTOM resize borders, etc. from the
            // native frame — because WM_NCCALCSIZE is NOT suppressed.
            let default_res = CallWindowProcW(OLD_WND_PROC, hwnd, msg, wparam, lparam);

            // Upgrade HTCAPTION → HTMAXBUTTON only when the cursor is exactly
            // over the maximize button so Windows 11 Snap Layouts popup activates.
            if default_res == HTCAPTION as LRESULT {
                let x = (lparam as u32 & 0xffff) as i16 as i32;
                let y = ((lparam as u32 >> 16) & 0xffff) as i16 as i32;

                let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
                if GetWindowRect(hwnd, &mut rect) != FALSE {
                    let win_width = rect.right - rect.left;
                    let rel_x = x - rect.left;
                    let rel_y = y - rect.top;

                    // Native caption height is typically 30-32px; use 40px to be safe.
                    let caption_h = 40i32;
                    // Maximize button is the middle of the three right-hand caption buttons.
                    // Each caption button is ~46px wide.
                    let btn_w = 46i32;
                    let maximize_left = win_width - btn_w * 2;
                    let maximize_right = win_width - btn_w;

                    if rel_y >= 0
                        && rel_y < caption_h
                        && rel_x >= maximize_left
                        && rel_x < maximize_right
                    {
                        return HTMAXBUTTON as LRESULT;
                    }
                }
            }

            return default_res;
        }

        // All other messages (including WM_NCCALCSIZE) go to the original proc.
        CallWindowProcW(OLD_WND_PROC, hwnd, msg, wparam, lparam)
    }
}
