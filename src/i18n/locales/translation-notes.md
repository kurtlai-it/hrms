# Translation notes (ms.json, zh.json)

JSON cannot hold comments, so uncertain strings are listed here. Each line is
`// TODO-translate <lang> <key> — "<current text>" — <what to check>`.
A native Bahasa Melayu / Chinese speaker should check each one, fix the JSON,
and delete the line.

Not listed (already agreed): the labels in hrms-claude-code-prompts-v4.md
Prompt 2 (home.*, group.*, bar.*, me.*) and the page names (page.*), first
written for the old prototype (docs/design/prototype.html), plus
me.language and me.signOut.

Statutory names follow the language (EPF = KWSP / 公积金, SOCSO = PERKESO /
社险, EIS = SIP / 就业保险). "PCB", "EA", "CP39", "MTD", "LHDN", "HRD Corp"
and "KPI" are kept as is.

## Bahasa Melayu (ms.json)

// TODO-translate ms nav.dashboard / dash.title — "Papan pemuka" — or keep "Dashboard"?
// TODO-translate ms nav.onboarding — "Kemasukan staf baharu" — usual HR term for onboarding?
// TODO-translate ms nav.companySetup — "Persediaan syarikat" — or "Tetapan syarikat"?
// TODO-translate ms nav.salaryInsights — "Analisis gaji"
// TODO-translate ms shell.systemViewBanner — "Anda melihat sistem — masuk ke syarikat untuk mengurus datanya."
// TODO-translate ms leaveType.hospitalization — "Cuti hospital" — Akta Kerja s.60F wording is "cuti hospital"?
// TODO-translate ms leaveType.paternity — "Cuti paterniti" — Akta Kerja s.60FA wording
// TODO-translate ms leaveType.compassionate — "Cuti ihsan" — or "cuti belas kasihan"?
// TODO-translate ms claimCategory.parking — "Letak kereta"
// TODO-translate ms dash.stat.payrollFinalized — "Gaji {{month}} dimuktamadkan · {{count}} slip gaji"
// TODO-translate ms dash.stat.headcountHint — "{{probation}} dalam percubaan · {{resigned}} telah berhenti"
// TODO-translate ms dash.compliance.contrib.title — "Bayaran caruman KWSP / PERKESO / SIP"
// TODO-translate ms dash.compliance.ea.note — "Penyata saraan tahunan, tahun taksiran sebelumnya"
// TODO-translate ms dash.compliance.formE.title — "Borang E majikan"
// TODO-translate ms dash.holidays.tentative — "Belum muktamad"
// TODO-translate ms dash.alerts.belowMinWageDetail — "{{names}}{{more}} bergaji pokok kurang daripada {{amount}}"
// TODO-translate ms dash.alerts.foreignEpfDetail_one / _other — official name of the Act: "Akta KWSP (Pindaan) 2025"?
// TODO-translate ms dash.charts.attendanceDesc — "Peratus staf berjadual yang hadir, 14 hari lepas"

## Chinese, Simplified (zh.json)

// TODO-translate zh role.HR — "人事" — or keep "HR"?
// TODO-translate zh nav.salaryInsights — "薪资分析"
// TODO-translate zh nav.onboarding / nav.offboarding — "入职" / "离职"
// TODO-translate zh leaveType.emergency — "紧急假"
// TODO-translate zh leaveType.compassionate — "丧假" — compassionate leave may cover more than bereavement
// TODO-translate zh claimCategory.travel — "交通差旅"
// TODO-translate zh common.more — "另有 {{count}} 位" — only used after people's names
// TODO-translate zh dash.stat.presentHint — "{{count}} 名在职员工中已打卡的人数" — word order after the number
// TODO-translate zh dash.compliance.contrib.title — "公积金 / 社险 / 就业保险缴款" — Malaysian Chinese terms for KWSP / PERKESO / SIP
// TODO-translate zh dash.compliance.cp39.note — "每月扣缴的税款交给内陆税收局 (LHDN)"
// TODO-translate zh dash.compliance.hrd.title — "HRD Corp 人力资源税缴款"
// TODO-translate zh dash.compliance.hrd.note — "注册雇主每月缴交（2001年PSMB法令）"
// TODO-translate zh dash.compliance.ea.note — "上一课税年的年度薪酬报表"
// TODO-translate zh dash.alerts.foreignEpf — "外籍员工须缴公积金"
// TODO-translate zh dash.alerts.foreignEpfDetail_one / _other — Act name "2025年公积金（修订）法令"

## Added in Prompt 3 (navigation)

// TODO-translate ms home.todoOt_one / _other — "Luluskan {{count}} rekod kerja lebih masa"
// TODO-translate ms me.screen / me.light / me.dark — "Skrin" / "Cerah" / "Gelap"
// TODO-translate ms a11y.skip — "Langkau ke kandungan utama" (screen-reader / keyboard link)
// TODO-translate zh bar.todo — "待办 ({{count}})"
// TODO-translate zh me.screen / me.light / me.dark — "屏幕" / "浅色" / "深色"

// TODO-help (all languages) help.tips.* — placeholder tips written for the
// prototype; HR should replace them with real guidance for each page.

## Added in Prompt 4 (Home "Things to do today")

// TODO-translate ms home.todoClockIn / home.clockIn — "Anda belum daftar masuk kerja hari ini" / "Daftar masuk"
// TODO-translate ms home.todoPayrollFinish — "Selesaikan gaji {{month}} (masih draf)"
// TODO-translate ms home.todoOwnLeave_* / home.todoOwnClaims_* — "... anda menunggu kelulusan"
// TODO-translate zh home.todoPayrollStart — "计算{{month}}薪资" — {{month}} is the Intl month name ("十月"); prototype wrote "10月"
// TODO-translate zh home.todoOnboarding_* — "审核 {{count}} 份新员工表格"

## Added after Prompt 4 (My numbers, payroll tracker, HR phone field, Reports page)

// TODO-translate ms home.myNumbers — "Angka saya" — or "Maklumat saya"?
// TODO-translate ms tracker.s3Title — "Muktamadkan bulan ini"
// TODO-translate ms tracker.markDone / tracker.doneBy — "Tanda selesai" / "Diselesaikan oleh {{name}} pada {{date}}"
// TODO-translate ms reports.meta.leave.title — "Liabiliti cuti" — accounting term
// TODO-translate ms reports.meta.payroll.title — "Daftar gaji"
// TODO-translate ms reports.col.carried — "Dibawa ke hadapan"
// TODO-translate ms reports.col.liability — "Nilai cuti"
// TODO-translate ms reports.note.leave — Akta Kerja s.60I(a) wording
// TODO-translate ms reports.status.notDue — "Belum tiba masa"
// TODO-translate zh home.myNumbers — "我的数字" — or "我的概况"?
// TODO-translate zh tracker.s3Title — "确认本月薪资" — "finalise" = 确认 / 定稿?
// TODO-translate zh reports.meta.leave.title — "假期负债" — accounting term
// TODO-translate zh reports.col.hrd / reports.chart.hrd — "HRD 税" — HRD Corp levy
// TODO-translate zh reports.note.leave — 《雇佣法令》第60I(a)条
// TODO-translate zh reports.note.compliance — agency names (公积金局、社险机构、内陆税收局)

## Added in Prompt 5 (Payroll run page)

// TODO-translate ms run.statusFinished / run.statusNotFinished — "Selesai" / "Belum selesai"
// TODO-translate ms run.totalTakeHome / run.colTakeHome — "gaji bawa pulang" — or "gaji bersih"?
// TODO-translate ms run.colClaimsBack — "Tuntutan dibayar balik"
// TODO-translate ms run.badgeOptOut — "Tidak menyertai" — opted out of EPF/SOCSO/EIS/PCB
// TODO-translate ms run.mistakeTitle — "Tersilap?"
// TODO-translate ms run.reviewApprove — "Semak dan luluskan"
// TODO-translate zh run.colTakeHome / run.totalTakeHome — "实发工资"
// TODO-translate zh run.colClaimsBack — "已退还的报销"
// TODO-translate zh run.badgeOptOut — "已选择退出"
// TODO-translate zh run.ic — "身份证 {{ic}}" — or keep "IC"?
// TODO-translate zh tracker.stepOf — "第 {{n}} 步（共5步）：{{title}}"

## Added in the wording pass (Home, dates, messages, pages)
// TODO-translate ms home.waitingFor — "Menunggu anda · {{date}}" — natural heading for the day's work list? ("Tugasan anda hari ini"?)
// TODO-translate ms app.goTo — "Pergi ke" — heading above the page tiles; "Halaman" may read better
// TODO-translate ms home.todoOt_other — "Kerja lebih masa untuk diluluskan ({{count}})" — "OT" is common in offices; keep the full term?
// TODO-translate zh home.waitingFor — "等您处理 · {{date}}" — natural heading for the day's work list?
// TODO-translate zh home.startPayroll — "开始计算工资" — button on a payroll row; "开始发薪" or "开始核算工资"?
// TODO-translate ms home.todoStaffPay — "Bayar gaji staf bagi {{month}}: tarikh akhir {{date}}" — "tarikh akhir" or "perlu dibayar sebelum"?
// TODO-translate ms home.todoProbationEnded_other — "Tempoh percubaan tamat, belum disahkan ({{count}}) · yang pertama tamat {{date}}" — natural word order?
// TODO-translate zh home.todoStatutory — "{{month}}的公积金、社险、就业保险和PCB：截止{{date}}" — Malaysian HR usage for EPF/SOCSO/EIS in Chinese
// TODO-translate zh home.clockedIn — "今天打卡时间" — label before the clock-in time
// TODO-translate ms staffList.addOneForm — "Tambah dengan satu borang" — second button next to "Tambah staf" (the step-by-step wizard)
// TODO-translate zh claimsPage.reviewN_other — "审核 {{count}} 项报销" — measure word for claims ("项" or "笔")?
// TODO-translate ms msg.claimApproved — "… Ia kini menunggu untuk dibayar melalui gaji." — natural phrasing for "waits to be paid through payroll"
// TODO-translate ms msg.otApproved — "… Ia dikira dalam gaji yang meliputi {{date}}." — "gaji" for "payroll run" here?
// TODO-translate zh msg.otApproved — "将计入涵盖{{date}}的工资" — clearer wording for "the payroll run that covers <date>"
// TODO-translate zh msg.namesMore — "{{names}}等另外 {{count}} 人" — word order
// TODO-translate ms help.tips.time — tips 4–5 (Akta Kerja 1955, pro rata) — check legal wording
// TODO-translate ms help.tips.claims — tips 3–5 (bayaran balik, Akta Cukai Pendapatan 1967, MyInvois) — check legal wording
// TODO-translate zh help.tips.time — tips 4–5 (《1955年雇佣法令》) — check legal wording
// TODO-translate zh help.tips.claims — tips 3–5 (退款, 《1967年所得税法令》) — check legal wording
// TODO-translate ms leaveBal.paternity — "Paterniti" — or "Cuti isteri bersalin" as used in HR forms?
// TODO-translate ms leaveBal.colEntitled — "Kelayakan" — column header for days entitled
// TODO-translate ms staffList.searchPlaceholder — "Nama, No. KP atau nombor staf" — "No. KP" for IC; "nombor pekerja"?
