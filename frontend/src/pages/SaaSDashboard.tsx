export default function SaaSDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg p-8 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-3">
            SaaS Admin Dashboard
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 font-medium">
            Welcome to the SaaS administration dashboard
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: 'Total Tenants', value: '0', color: 'from-blue-500 to-cyan-500', icon: '🏢' },
            { title: 'Active ISPs', value: '0', color: 'from-emerald-500 to-teal-500', icon: '✅' },
            { title: 'Total Revenue', value: '$0', color: 'from-amber-500 to-orange-500', icon: '💰' },
            { title: 'System Health', value: '100%', color: 'from-purple-500 to-pink-500', icon: '💚' },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                  {stat.icon}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{stat.title}</h3>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
