import SwiftUI

@main
struct YogaBookingApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
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
    @State private var password = "Yomi@2026"
    @State private var status = ""
    @State private var showStaff = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Yoga Booking")
                .font(.largeTitle.bold())

            Picker("Role", selection: $selectedRole) {
                Text("Student").tag(AppRole.student)
                Text("Coach").tag(AppRole.coach)
                if showStaff {
                    Text("Staff").tag(AppRole.staff)
                }
            }
            .pickerStyle(.segmented)

            TextField("Email", text: $email)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .textFieldStyle(.roundedBorder)

            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)

            Button("Sign In") {
                Task { await signIn() }
            }
            .buttonStyle(.borderedProminent)

            Button("Staff Sign In") {
                showStaff = true
                selectedRole = .staff
                email = "staff@example.com"
            }
            .font(.footnote)
            .foregroundStyle(.secondary)

            if !status.isEmpty {
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding()
        .onChange(of: selectedRole) { _, role in
            if role == .coach { email = "coach@example.com" }
            if role == .student { email = "student@example.com" }
        }
    }

    private func signIn() async {
        do {
            let response = try await APIClient.shared.login(email: email, password: password, role: selectedRole, locale: appState.locale)
            await appState.apply(login: response)
        } catch {
            status = "Sign in failed"
        }
    }
}

struct StudentHomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var sessions: [AvailabilitySession] = []
    @State private var cards: [MemberCard] = []
    @State private var methods: [PaymentMethod] = []
    @State private var status = ""

    var body: some View {
        List {
            Section("Member Card") {
                ForEach(cards) { card in
                    HStack {
                        Text(card.status.capitalized)
                        Spacer()
                        Text("\(card.remainingCredits)/\(card.totalCredits)")
                    }
                }
            }

            Section("Available Classes") {
                ForEach(sessions) { session in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(session.course?.title ?? session.courseId)
                            .font(.headline)
                        Text(session.coach?.name ?? session.coachId)
                            .foregroundStyle(.secondary)
                        Text(session.startsAt, style: .date)
                        HStack {
                            Text("Remaining: \(session.remainingCapacity)")
                            Spacer()
                            Button("Book") {
                                Task { await book(session) }
                            }
                        }
                    }
                }
            }

            Section("Payment Methods") {
                ForEach(methods) { method in
                    HStack {
                        Text(method.display[appState.locale] ?? method.display["en"] ?? method.code)
                        Spacer()
                        Text(method.code)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if !status.isEmpty {
                Section {
                    Text(status)
                }
            }
        }
        .navigationTitle("Student")
        .toolbar {
            Button("Logout") {
                Task { await appState.logout() }
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            async let nextSessions = APIClient.shared.availability(locale: appState.locale)
            async let memberCards = APIClient.shared.memberCards()
            async let paymentMethods = APIClient.shared.paymentMethods(country: "KR", currency: "KRW")
            sessions = try await nextSessions
            cards = try await memberCards
            methods = try await paymentMethods
        } catch {
            status = "Failed to load data"
        }
    }

    private func book(_ session: AvailabilitySession) async {
        do {
            _ = try await APIClient.shared.createBooking(courseSessionId: session.id, paymentMode: "member_card")
            status = "Booking confirmed"
            await load()
        } catch {
            status = "Booking failed"
        }
    }
}

struct CoachHomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var bookings: [Booking] = []

    var body: some View {
        List(bookings) { booking in
            VStack(alignment: .leading) {
                Text(booking.course?.title ?? booking.courseId)
                    .font(.headline)
                Text(booking.startsAt, style: .time)
                Text(booking.status)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Coach")
        .toolbar {
            Button("Logout") {
                Task { await appState.logout() }
            }
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
                        Text(booking.status)
                            .foregroundStyle(.secondary)
                        Button("Manual Check-in") {
                            Task { await checkIn(booking) }
                        }
                        .disabled(booking.status == "checked_in")
                    }
                }
            }
            if !status.isEmpty {
                Section {
                    Text(status)
                }
            }
        }
        .navigationTitle("Staff")
        .toolbar {
            Button("Logout") {
                Task { await appState.logout() }
            }
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
