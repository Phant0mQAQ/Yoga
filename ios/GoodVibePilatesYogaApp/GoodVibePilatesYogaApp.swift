import SwiftUI

@main
struct GoodVibePilatesYogaApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .tint(StudioTheme.forest)
        }
    }
}

@MainActor
final class AppState: ObservableObject {
    @Published var token: String?
    @Published var user: User?
    @Published var activeRole: AppRole?
    @Published var locale: String = Locale.current.language.languageCode?.identifier == "ko" ? "ko" : Locale.current.language.languageCode?.identifier == "zh" ? "zh-Hans" : "en"

    var isAuthenticated: Bool {
        token != nil && activeRole != nil
    }

    func apply(login: LoginResponse) async {
        token = login.token
        user = login.user
        activeRole = login.session.activeRole
        await APIClient.shared.setToken(login.token)
    }

    func logout() async {
        try? await APIClient.shared.logout()
        token = nil
        user = nil
        activeRole = nil
    }
}

private enum StudioTheme {
    static let background = Color(red: 0.965, green: 0.957, blue: 0.925)
    static let surface = Color(red: 1.0, green: 0.996, blue: 0.98)
    static let forest = Color(red: 0.192, green: 0.318, blue: 0.247)
    static let forestDeep = Color(red: 0.094, green: 0.192, blue: 0.141)
    static let sage = Color(red: 0.902, green: 0.925, blue: 0.902)
    static let coral = Color(red: 0.906, green: 0.396, blue: 0.325)
    static let coralSoft = Color(red: 0.98, green: 0.914, blue: 0.894)
    static let ink = Color(red: 0.094, green: 0.192, blue: 0.141)
    static let muted = Color(red: 0.408, green: 0.451, blue: 0.424)
    static let line = Color(red: 0.843, green: 0.863, blue: 0.835)
}

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            if let role = appState.activeRole {
                switch role {
                case .student:
                    StudentHomeView()
                case .coach:
                    CoachHomeView()
                case .staff:
                    StaffOperationsView()
                }
            } else {
                LoginView()
            }
        }
    }
}

struct LoginView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedRole: AppRole = .student
    @State private var email = "student@example.com"
    @State private var password = "GoodVibe@2026"
    @State private var status = ""
    @State private var showStaff = false
    @State private var isSigningIn = false

    var body: some View {
        ZStack {
            StudioTheme.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    brandHeader
                    loginCard
                }
                .frame(maxWidth: 560)
                .padding(.horizontal, 22)
                .padding(.vertical, 38)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationBarHidden(true)
        .onChange(of: selectedRole) { _, role in
            if role == .coach { email = "coach@example.com" }
            if role == .student { email = "student@example.com" }
        }
    }

    private var brandHeader: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image("GoodVibeLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 76, height: 90)
                .accessibilityLabel("Good Vibe Pilates & Yoga logo")

            VStack(alignment: .leading, spacing: 6) {
                Text("GOOD VIBE STUDIO")
                    .font(.caption2.weight(.bold))
                    .tracking(2)
                    .foregroundStyle(StudioTheme.coral)
                Text("Move well. Feel at home.")
                    .font(.system(.largeTitle, design: .serif, weight: .semibold))
                    .foregroundStyle(StudioTheme.ink)
                Text("Pilates and yoga, thoughtfully scheduled around your day.")
                    .font(.subheadline)
                    .foregroundStyle(StudioTheme.muted)
            }
        }
    }

    private var loginCard: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Welcome back")
                    .font(.system(.title2, design: .serif, weight: .semibold))
                    .foregroundStyle(StudioTheme.ink)
                Text("Sign in to continue to your studio.")
                    .font(.footnote)
                    .foregroundStyle(StudioTheme.muted)
            }

            Picker("Role", selection: $selectedRole) {
                Text("Student").tag(AppRole.student)
                Text("Coach").tag(AppRole.coach)
                if showStaff {
                    Text("Staff").tag(AppRole.staff)
                }
            }
            .pickerStyle(.segmented)

            VStack(spacing: 14) {
                StudioField(title: "Email", systemImage: "envelope") {
                    TextField("name@example.com", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .textContentType(.username)
                }

                StudioField(title: "Password", systemImage: "lock") {
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                }
            }

            Button {
                Task { await signIn() }
            } label: {
                HStack(spacing: 8) {
                    if isSigningIn {
                        ProgressView().tint(.white)
                    }
                    Text(isSigningIn ? "Signing in…" : "Sign In")
                }
            }
            .buttonStyle(StudioPrimaryButtonStyle())
            .disabled(isSigningIn)

            Button("Staff Sign In") {
                showStaff = true
                selectedRole = .staff
                email = "staff@example.com"
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(StudioTheme.forest)
            .frame(maxWidth: .infinity)

            if !status.isEmpty {
                Label(status, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(StudioTheme.coral)
                    .accessibilityLabel("Sign in error: \(status)")
            }
        }
        .padding(22)
        .background(StudioTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(StudioTheme.line, lineWidth: 1)
        }
    }

    private func signIn() async {
        guard !isSigningIn else { return }
        isSigningIn = true
        status = ""
        defer { isSigningIn = false }
        do {
            let response = try await APIClient.shared.login(email: email, password: password, role: selectedRole, locale: appState.locale)
            await appState.apply(login: response)
        } catch {
            status = "Sign in failed"
        }
    }
}

private struct StudioField<Content: View>: View {
    let title: String
    let systemImage: String
    let content: Content

    init(title: String, systemImage: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.systemImage = systemImage
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title.uppercased())
                .font(.caption2.weight(.bold))
                .tracking(1.1)
                .foregroundStyle(StudioTheme.muted)
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .foregroundStyle(StudioTheme.forest)
                    .frame(width: 18)
                content
            }
            .padding(.horizontal, 13)
            .frame(minHeight: 50)
            .background(StudioTheme.background)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(StudioTheme.line, lineWidth: 1)
            }
        }
    }
}

private struct StudioPrimaryButtonStyle: ButtonStyle {
    var color: Color = StudioTheme.forest

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(configuration.isPressed ? color.opacity(0.82) : color)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.99 : 1)
    }
}

private enum StudentTab: Hashable {
    case home
    case bookings
    case account
}

struct StudentHomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedTab: StudentTab = .home
    @State private var sessions: [AvailabilitySession] = []
    @State private var cards: [MemberCard] = []
    @State private var methods: [PaymentMethod] = []
    @State private var status = ""
    @State private var isLoading = true
    @State private var bookingSessionID: String?

    var body: some View {
        TabView(selection: $selectedTab) {
            StudentDashboardView(
                name: appState.user?.name ?? "Member",
                cards: cards,
                sessions: sessions,
                status: status,
                isLoading: isLoading,
                bookingSessionID: bookingSessionID,
                onSeeAll: { selectedTab = .bookings },
                onBook: book
            )
            .tabItem { Label("Home", systemImage: "house") }
            .tag(StudentTab.home)

            StudentBookingsView(
                sessions: sessions,
                status: status,
                isLoading: isLoading,
                bookingSessionID: bookingSessionID,
                onBook: book
            )
            .tabItem { Label("Bookings", systemImage: "calendar") }
            .tag(StudentTab.bookings)

            StudentAccountView(user: appState.user, methods: methods) {
                Task { await appState.logout() }
            }
            .tabItem { Label("Account", systemImage: "person") }
            .tag(StudentTab.account)
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let nextSessions = APIClient.shared.availability(locale: appState.locale)
            async let memberCards = APIClient.shared.memberCards()
            async let paymentMethods = APIClient.shared.paymentMethods(country: "KR", currency: "KRW", allSupported: true)
            sessions = try await nextSessions
            cards = try await memberCards
            methods = try await paymentMethods
        } catch {
            status = "Failed to load data"
        }
    }

    private func book(_ session: AvailabilitySession) async {
        guard bookingSessionID == nil else { return }
        bookingSessionID = session.id
        defer { bookingSessionID = nil }
        do {
            _ = try await APIClient.shared.createBooking(courseSessionId: session.id, paymentMode: "member_card")
            status = "Booking confirmed"
            await load()
        } catch {
            status = "Booking failed"
        }
    }
}

private struct StudentDashboardView: View {
    let name: String
    let cards: [MemberCard]
    let sessions: [AvailabilitySession]
    let status: String
    let isLoading: Bool
    let bookingSessionID: String?
    let onSeeAll: () -> Void
    let onBook: (AvailabilitySession) async -> Void

    private var firstName: String {
        name.split(separator: " ").first.map(String.init) ?? name
    }

    private var activeCard: MemberCard? {
        cards.first(where: { $0.status == "active" }) ?? cards.first
    }

    var body: some View {
        ZStack {
            StudioTheme.background.ignoresSafeArea()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 24) {
                    StudioScreenHeader(
                        eyebrow: "GOOD VIBE STUDIO",
                        title: "Good morning, \(firstName).",
                        subtitle: "Your next good move starts here."
                    )

                    MembershipHero(card: activeCard)

                    StudioMetrics(
                        credits: activeCard?.remainingCredits ?? 0,
                        classes: sessions.count
                    )

                    if !status.isEmpty {
                        StudioNotice(message: status, isSuccess: status == "Booking confirmed")
                    }

                    SectionTitle(title: "Upcoming classes", actionTitle: "See all", action: onSeeAll)

                    if isLoading {
                        ProgressView("Finding your classes…")
                            .frame(maxWidth: .infinity, minHeight: 140)
                            .tint(StudioTheme.forest)
                    } else if sessions.isEmpty {
                        StudioEmptyState(
                            icon: "calendar.badge.clock",
                            title: "No classes yet",
                            message: "New sessions will appear here as soon as they are published."
                        )
                    } else {
                        ForEach(sessions.prefix(3)) { session in
                            ClassSessionRow(
                                session: session,
                                isBooking: bookingSessionID == session.id,
                                onBook: { await onBook(session) }
                            )
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 34)
            }
        }
    }
}

private struct StudentBookingsView: View {
    let sessions: [AvailabilitySession]
    let status: String
    let isLoading: Bool
    let bookingSessionID: String?
    let onBook: (AvailabilitySession) async -> Void

    var body: some View {
        ZStack {
            StudioTheme.background.ignoresSafeArea()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    StudioScreenHeader(
                        eyebrow: "SCHEDULE",
                        title: "Find your next class.",
                        subtitle: "Choose a session and reserve with your member card."
                    )

                    if !status.isEmpty {
                        StudioNotice(message: status, isSuccess: status == "Booking confirmed")
                    }

                    if isLoading {
                        ProgressView("Loading schedule…")
                            .frame(maxWidth: .infinity, minHeight: 220)
                            .tint(StudioTheme.forest)
                    } else if sessions.isEmpty {
                        StudioEmptyState(
                            icon: "calendar.badge.clock",
                            title: "Schedule is resting",
                            message: "Check back soon for the next release of classes."
                        )
                    } else {
                        ForEach(sessions) { session in
                            ClassSessionRow(
                                session: session,
                                isBooking: bookingSessionID == session.id,
                                onBook: { await onBook(session) }
                            )
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 34)
            }
        }
    }
}

private struct StudentAccountView: View {
    let user: User?
    let methods: [PaymentMethod]
    let onLogout: () -> Void
    @State private var isPaymentMethodsExpanded = false

    private var displayMethods: [PaymentMethod] {
        let walletCapabilities = [
            PaymentMethod(
                code: "apple_pay",
                family: "wallet",
                display: ["en": "Apple Pay", "zh": "Apple Pay", "zh-Hans": "Apple Pay", "ko": "Apple Pay"],
                flow: "native_or_checkout",
                recurring: true
            ),
            PaymentMethod(
                code: "google_pay",
                family: "wallet",
                display: ["en": "Google Pay", "zh": "Google Pay", "zh-Hans": "Google Pay", "ko": "Google Pay"],
                flow: "native_or_checkout",
                recurring: true
            )
        ].filter { capability in
            !methods.contains(where: { $0.code == capability.code })
        }
        var result = methods
        let insertionIndex = methods.firstIndex(where: { $0.code == "card" })
            .map { result.index(after: $0) } ?? result.startIndex
        result.insert(contentsOf: walletCapabilities, at: insertionIndex)
        return result
    }

    var body: some View {
        ZStack {
            StudioTheme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    StudioScreenHeader(
                        eyebrow: "YOUR STUDIO",
                        title: "Account",
                        subtitle: "Membership details and payment preferences."
                    )

                    VStack(spacing: 0) {
                        AccountRow(icon: "person", title: "Name", value: user?.name ?? "—")
                        Divider().overlay(StudioTheme.line)
                        AccountRow(icon: "envelope", title: "Email", value: user?.email ?? "—")
                        Divider().overlay(StudioTheme.line)
                        AccountRow(icon: "globe", title: "Language", value: user?.locale ?? "—")
                    }
                    .background(StudioTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(StudioTheme.line, lineWidth: 1)
                    }

                    DisclosureGroup(isExpanded: $isPaymentMethodsExpanded) {
                        VStack(spacing: 10) {
                            ForEach(displayMethods) { method in
                                VStack(alignment: .leading, spacing: 12) {
                                    HStack(spacing: 14) {
                                        PaymentMethodLogo(code: method.code)
                                        Text(method.display[user?.locale ?? "en"] ?? method.display["en"] ?? method.code)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(StudioTheme.ink)
                                        Spacer()
                                    }
                                    if method.code == "card" {
                                        CardNetworkLogos()
                                    }
                                }
                                .padding(14)
                                .background(StudioTheme.background)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(StudioTheme.line, lineWidth: 1)
                                }
                            }
                        }
                        .padding(.top, 14)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Payment methods")
                                    .font(.headline)
                                    .foregroundStyle(StudioTheme.ink)
                                Text("All supported payment options")
                                    .font(.caption)
                                    .foregroundStyle(StudioTheme.muted)
                            }
                            Spacer()
                        }
                    }
                    .tint(StudioTheme.forest)
                    .padding(16)
                    .background(StudioTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(StudioTheme.line, lineWidth: 1)
                    }

                    Button("Sign Out", action: onLogout)
                        .buttonStyle(StudioPrimaryButtonStyle(color: StudioTheme.coral))
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 34)
            }
        }
    }
}

private struct PaymentMethodLogo: View {
    let code: String

    var body: some View {
        Image("payment-\(assetName)")
            .resizable()
            .scaledToFit()
            .frame(width: 50, height: 42)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.black.opacity(0.10), lineWidth: 1)
            }
        .accessibilityHidden(true)
    }

    private var assetName: String {
        switch code {
        case "apple_pay": return "apple-pay"
        case "google_pay": return "google-pay"
        case "wechat_pay": return "wechat-pay"
        case "kakao_pay": return "kakao-pay"
        case "naver_pay": return "naver-pay"
        case "samsung_pay": return "samsung-pay"
        default: return code == "card" ? "card" : code
        }
    }
}

private struct CardNetworkLogos: View {
    private let networks = ["Visa", "Mastercard", "American Express", "Discover", "JCB", "Diners Club", "UnionPay"]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 5), count: 4)

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 5) {
            ForEach(networks, id: \.self) { network in
                CardNetworkLogo(network: network)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Accepted card networks: Visa, Mastercard, American Express, Discover, JCB, Diners Club, UnionPay")
    }
}

private struct CardNetworkLogo: View {
    let network: String

    var body: some View {
        Image("payment-\(assetName)")
            .resizable()
            .scaledToFit()
            .frame(maxWidth: .infinity)
            .frame(height: 39)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .stroke(Color.black.opacity(0.11), lineWidth: 1)
            }
        .accessibilityLabel(network)
    }

    private var assetName: String {
        switch network {
        case "American Express": return "american-express"
        case "Diners Club": return "diners-club"
        case "UnionPay": return "unionpay"
        default: return network.lowercased()
        }
    }
}

private struct StudioScreenHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(eyebrow)
                .font(.caption2.weight(.bold))
                .tracking(1.7)
                .foregroundStyle(StudioTheme.coral)
            Text(title)
                .font(.system(.largeTitle, design: .serif, weight: .semibold))
                .foregroundStyle(StudioTheme.ink)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(StudioTheme.muted)
        }
    }
}

private struct MembershipHero: View {
    let card: MemberCard?

    var body: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(StudioTheme.forestDeep)

            Image(systemName: "leaf.fill")
                .font(.system(size: 78))
                .foregroundStyle(Color.white.opacity(0.06))
                .rotationEffect(.degrees(-24))
                .offset(x: 18, y: -10)

            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Text("MEMBER CARD")
                        .font(.caption2.weight(.bold))
                        .tracking(1.6)
                    Spacer()
                    Text(card?.status.uppercased() ?? "NOT ACTIVE")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(Color.white.opacity(0.12))
                        .clipShape(Capsule())
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Text("\(card?.remainingCredits ?? 0)")
                            .font(.system(size: 44, weight: .semibold, design: .serif))
                        Text("classes remaining")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color.white.opacity(0.72))
                    }
                    if let card {
                        Text("Valid until \(card.expiresAt.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption)
                            .foregroundStyle(Color.white.opacity(0.62))
                    } else {
                        Text("Your active membership will appear here.")
                            .font(.caption)
                            .foregroundStyle(Color.white.opacity(0.62))
                    }
                }
            }
            .foregroundStyle(.white)
            .padding(20)
        }
        .frame(minHeight: 176)
        .accessibilityElement(children: .combine)
    }
}

private struct StudioMetrics: View {
    let credits: Int
    let classes: Int

    var body: some View {
        HStack(spacing: 0) {
            MetricItem(value: "\(credits)", label: "Credits")
            Divider().frame(height: 42).overlay(StudioTheme.line)
            MetricItem(value: "\(classes)", label: "Classes")
        }
        .padding(.vertical, 4)
    }
}

private struct MetricItem: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(.title2, design: .serif, weight: .semibold))
                .foregroundStyle(StudioTheme.ink)
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(1)
                .foregroundStyle(StudioTheme.muted)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct SectionTitle: View {
    let title: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.system(.title2, design: .serif, weight: .semibold))
                .foregroundStyle(StudioTheme.ink)
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(StudioTheme.forest)
            }
        }
    }
}

private struct ClassSessionRow: View {
    let session: AvailabilitySession
    let isBooking: Bool
    let onBook: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            if let imageURL = session.course?.imageURL {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        courseImagePlaceholder
                    case .empty:
                        ZStack {
                            StudioTheme.sage
                            ProgressView()
                                .tint(StudioTheme.forest)
                        }
                    @unknown default:
                        courseImagePlaceholder
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 150)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .accessibilityLabel(session.course?.title ?? "Course image")
            }

            HStack(alignment: .top, spacing: 14) {
                VStack(spacing: 1) {
                    Text(session.startsAt, format: .dateTime.month(.abbreviated))
                        .font(.system(size: 10, weight: .bold))
                        .textCase(.uppercase)
                        .foregroundStyle(StudioTheme.coral)
                    Text(session.startsAt, format: .dateTime.day())
                        .font(.system(.title2, design: .serif, weight: .semibold))
                        .foregroundStyle(StudioTheme.ink)
                }
                .frame(width: 44)

                Rectangle()
                    .fill(StudioTheme.line)
                    .frame(width: 1, height: 48)

                VStack(alignment: .leading, spacing: 5) {
                    Text(session.course?.title ?? session.courseId)
                        .font(.headline)
                        .foregroundStyle(StudioTheme.ink)
                    Text(session.coach?.name ?? session.coachId)
                        .font(.subheadline)
                        .foregroundStyle(StudioTheme.muted)
                    Label {
                        Text(session.startsAt, format: .dateTime.weekday(.abbreviated).hour().minute())
                    } icon: {
                        Image(systemName: "clock")
                    }
                    .font(.caption)
                    .foregroundStyle(StudioTheme.muted)
                }
                Spacer(minLength: 4)
            }

            HStack {
                Label(
                    "\(session.reservationCount) booked · \(session.availableSpots) spots left",
                    systemImage: "person.2"
                )
                    .font(.caption.weight(.medium))
                    .foregroundStyle(StudioTheme.muted)
                    .accessibilityLabel(
                        "\(session.reservationCount) people booked, \(session.availableSpots) spots left"
                    )
                Spacer()
                Button {
                    Task { await onBook() }
                } label: {
                    if isBooking {
                        ProgressView().tint(.white)
                    } else {
                        Text("Book class")
                    }
                }
                .font(.footnote.weight(.bold))
                .foregroundStyle(.white)
                .frame(minWidth: 106, minHeight: 44)
                .background(StudioTheme.coral)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .disabled(isBooking || session.availableSpots <= 0)
                .accessibilityLabel("Book \(session.course?.title ?? "class")")
            }
        }
        .padding(16)
        .background(StudioTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .stroke(StudioTheme.line, lineWidth: 1)
        }
    }

    private var courseImagePlaceholder: some View {
        ZStack {
            StudioTheme.sage
            Image(systemName: "photo")
                .font(.title2)
                .foregroundStyle(StudioTheme.forest)
        }
    }
}

private struct StudioNotice: View {
    let message: String
    let isSuccess: Bool

    var body: some View {
        Label(message, systemImage: isSuccess ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
            .font(.footnote.weight(.medium))
            .foregroundStyle(isSuccess ? StudioTheme.forest : StudioTheme.coral)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(isSuccess ? StudioTheme.sage : StudioTheme.coralSoft)
            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
    }
}

private struct StudioEmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .foregroundStyle(StudioTheme.forest)
            Text(title)
                .font(.system(.title3, design: .serif, weight: .semibold))
                .foregroundStyle(StudioTheme.ink)
            Text(message)
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(StudioTheme.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 170)
        .padding(20)
        .background(StudioTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .stroke(StudioTheme.line, lineWidth: 1)
        }
    }
}

private struct AccountRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .foregroundStyle(StudioTheme.forest)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(StudioTheme.muted)
                Text(value)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(StudioTheme.ink)
            }
            Spacer()
        }
        .padding(16)
    }
}

struct CoachHomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var bookings: [Booking] = []

    var body: some View {
        List(bookings) { booking in
            VStack(alignment: .leading, spacing: 6) {
                Text(booking.course?.title ?? booking.courseId)
                    .font(.headline)
                Text(booking.startsAt, style: .time)
                Text(booking.status.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(StudioTheme.forest)
            }
            .padding(.vertical, 6)
        }
        .scrollContentBackground(.hidden)
        .background(StudioTheme.background)
        .navigationTitle("Coach Schedule")
        .toolbar {
            Button("Logout") { Task { await appState.logout() } }
        }
        .task {
            bookings = (try? await APIClient.shared.bookings(locale: appState.locale)) ?? []
        }
    }
}

struct StaffOperationsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var bookings: [Booking] = []
    @State private var status = ""

    var body: some View {
        List {
            Section("Today Bookings") {
                ForEach(bookings) { booking in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(booking.course?.title ?? booking.courseId)
                            .font(.headline)
                        Text(booking.user?.name ?? booking.userId)
                        Text(booking.status.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(StudioTheme.forest)
                        Button("Manual Check-in") {
                            Task { await checkIn(booking) }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(StudioTheme.forest)
                        .disabled(booking.status == "checked_in")
                    }
                    .padding(.vertical, 6)
                }
            }
            if !status.isEmpty {
                Section { Text(status) }
            }
        }
        .scrollContentBackground(.hidden)
        .background(StudioTheme.background)
        .navigationTitle("Front Desk")
        .toolbar {
            Button("Logout") { Task { await appState.logout() } }
        }
        .task { await load() }
    }

    private func load() async {
        bookings = (try? await APIClient.shared.bookings(locale: appState.locale)) ?? []
    }

    private func checkIn(_ booking: Booking) async {
        do {
            try await APIClient.shared.checkIn(bookingId: booking.id)
            status = "Checked in"
            await load()
        } catch {
            status = "Check-in failed"
        }
    }
}
