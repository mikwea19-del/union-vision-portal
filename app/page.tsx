"use client";

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Clock, CheckCircle, BarChart3, 
  Plus, Brain, LogOut, ChevronRight, Play, X,
  GraduationCap, AlertCircle, Trash2, Save,
  Activity, Target, Award, Upload, FileText,
  FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  studentId?: string;
  name: string;
  role: 'teacher' | 'student';
  department: string;
  password: string;
  email?: string;
  createdAt?: string;
}

interface Exam {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  duration: number;
  department: string;
  questions: Question[];
  createdAt: string;
}

interface Question {
  text: string;
  options: string[];
  correct: number;
}

interface Result {
  id: string;
  studentId: string;
  examId: string;
  score: number;
  totalQuestions: number;
  date: string;
}

export default function UnionVisionPortal() {
  // --- STATE MANAGEMENT ---
  const [users, setUsers] = useState<User[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('auth'); // auth, teacher_dash, student_dash, create_exam, take_exam
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'success' | 'error', onClose: null as (() => void) | null });

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from Supabase on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading data from Supabase...');

      // Load all data in parallel
      const [usersResponse, examsResponse, resultsResponse] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('exams').select('*'),
        supabase.from('results').select('*')
      ]);

      console.log('Users response:', usersResponse);
      console.log('Exams response:', examsResponse);
      console.log('Results response:', resultsResponse);

      if (usersResponse.error) throw usersResponse.error;
      if (examsResponse.error) throw examsResponse.error;
      if (resultsResponse.error) throw resultsResponse.error;

      setUsers(usersResponse.data || []);
      setExams(examsResponse.data || []);
      setResults(resultsResponse.data || []);
      
      console.log('Data loaded successfully');
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data from database. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // --- HELPER FUNCTIONS ---
  const showModal = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info', onClose: (() => void) | null = null) => {
    setModal({ isOpen: true, title, message, type, onClose });
  };

  const closeModal = () => {
    if (modal.onClose) modal.onClose();
    setModal({ isOpen: false, title: '', message: '', type: 'info', onClose: null });
  };

  // --- DELETE & EXPORT FUNCTIONS ---
  const deleteStudent = async (studentId: string) => {
    try {
      // Delete from results first (foreign key constraint)
      const { error: resultsError } = await supabase
        .from('results')
        .delete()
        .eq('student_id', studentId);

      if (resultsError) throw resultsError;

      // Delete the user
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', studentId);

      if (userError) throw userError;

      // Update local state
      setUsers(users.filter(u => u.id !== studentId));
      setResults(results.filter(r => r.studentId !== studentId));
      showModal('Student Deleted', 'The student and their records have been removed.', 'success');
    } catch (err) {
      console.error('Error deleting student:', err);
      showModal('Error', 'Failed to delete student. Please try again.', 'error');
    }
  };

  const deleteExam = async (examId: string) => {
    try {
      // Delete from results first (foreign key constraint)
      const { error: resultsError } = await supabase
        .from('results')
        .delete()
        .eq('exam_id', examId);

      if (resultsError) throw resultsError;

      // Delete the exam
      const { error: examError } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (examError) throw examError;

      // Update local state
      setExams(exams.filter(e => e.id !== examId));
      setResults(results.filter(r => r.examId !== examId));
      showModal('Exam Deleted', 'The exam and all related results have been removed.', 'success');
    } catch (err) {
      console.error('Error deleting exam:', err);
      showModal('Error', 'Failed to delete exam. Please try again.', 'error');
    }
  };

  const exportResultsCSV = () => {
    if (!currentUser) return;
    const myExams = exams.filter(e => e.teacherId === currentUser.id);
    const myResults = results.filter(r => myExams.map(me => me.id).includes(r.examId));

    if (myResults.length === 0) {
      showModal('Export Failed', 'No results available to export.', 'error');
      return;
    }

    const headers = ['Student Name', 'Student ID', 'Department', 'Exam Title', 'Score', 'Total Questions', 'Percentage', 'Date Taken'];
    const rows = myResults.map(r => {
      const student = users.find(u => u.id === r.studentId) || {} as Partial<User>;
      const exam = exams.find(e => e.id === r.examId) || {} as Partial<Exam>;
      const percentage = Math.round((r.score / r.totalQuestions) * 100);
      return [
        `"${student.name || 'Unknown'}"`,
        `"${student.studentId || 'N/A'}"`,
        `"${student.department || 'N/A'}"`,
        `"${exam.title || 'Deleted Exam'}"`,
        r.score,
        r.totalQuestions,
        `${percentage}%`,
        `"${new Date(r.date).toLocaleString()}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Union_Vision_Results_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- VIEWS ---

  const AuthView = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [loginId, setLoginId] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [regName, setRegName] = useState('');
    const [regDept, setRegDept] = useState('Accounting');
    const [regPassword, setRegPassword] = useState('');

    const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const user = users.find(u => (u.email === loginId || u.studentId === loginId) && u.password === loginPassword);
      if (user) {
        setCurrentUser(user);
        setCurrentView(user.role === 'teacher' ? 'teacher_dash' : 'student_dash');
      } else {
        showModal('Login Failed', 'Invalid credentials. Please try again.', 'error');
      }
    };

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const newStudentId = `UNV-${1000 + users.length}`;
      const newUser: User = {
        id: newStudentId,
        studentId: newStudentId,
        name: regName,
        role: 'student',
        department: regDept,
        password: regPassword
      };

      try {
        const { error } = await supabase
          .from('users')
          .insert([newUser]);

        if (error) throw error;

        setUsers([...users, newUser]);
        showModal('Registration Successful', `Your Student ID is: ${newStudentId}. Please use this to log in.`, 'success', () => {
          setIsLogin(true);
          setLoginId(newStudentId);
        });
      } catch (err) {
        console.error('Error registering user:', err);
        showModal('Registration Failed', 'Failed to create account. Please try again.', 'error');
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/30 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/30 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        <div className="w-full max-w-md z-10 animate-in zoom-in-95 duration-500">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-[0_0_40px_rgba(6,182,212,0.5)] mb-6 transform rotate-3">
              <GraduationCap size={40} color="white" className="-rotate-3" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Union Vision</h1>
            <p className="text-cyan-400 mt-2 font-mono text-sm tracking-widest uppercase">Online Testing Platform</p>
          </div>

          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
            
            <div className="flex mb-8 bg-white/5 rounded-xl p-1 border border-white/10">
              <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white'}`}>
                Sign In
              </button>
              <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white'}`}>
                Register (Student)
              </button>
            </div>

            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in slide-in-from-left-4">
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Student ID or Teacher Email</label>
                  <input required type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all placeholder-white/20" placeholder="Your ID or Email" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Password</label>
                  <input required type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all placeholder-white/20" placeholder="••••••••" />
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 rounded-xl transition-all transform hover:-translate-y-1 shadow-[0_10px_20px_-10px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2">
                  Access Portal <ChevronRight size={18} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5 animate-in fade-in slide-in-from-right-4">
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Full Name</label>
                  <input required type="text" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-purple-400 transition-all placeholder-white/20" placeholder="Your Full Name" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Department</label>
                  <select value={regDept} onChange={(e) => setRegDept(e.target.value)} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-purple-400 transition-all">
                    <option value="Accounting">Accounting</option>
                    <option value="Management">Management</option>
                    <option value="Human Resources">Human Resources</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Create Password</label>
                  <input required type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-purple-400 transition-all placeholder-white/20" placeholder="••••••••" />
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-bold py-4 rounded-xl transition-all transform hover:-translate-y-1 shadow-[0_10px_20px_-10px_rgba(168,85,247,0.5)] flex items-center justify-center gap-2">
                  Generate Student ID <CheckCircle size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TeacherDashboard = () => {
    if (!currentUser) return null;
    const [activeTab, setActiveTab] = useState('overview');
    const myExams = exams.filter(e => e.teacherId === currentUser.id);
    const myResults = results.filter(r => myExams.map(me => me.id).includes(r.examId));

    const chartData = myExams.map(exam => {
      const examResults = myResults.filter(r => r.examId === exam.id);
      const avg = examResults.length 
        ? Math.round(examResults.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / examResults.length * 100) 
        : 0;
      return {
        name: exam.title.length > 15 ? exam.title.substring(0, 15) + '...' : exam.title,
        avgScore: avg,
        participants: examResults.length
      };
    });

    const averageTotalScore = myResults.length 
      ? Math.round(myResults.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / myResults.length * 100) 
      : 0;

    const allStudents = users.filter(u => u.role === 'student');

    return (
      <div className="pt-28 pb-12 px-6 max-w-7xl mx-auto animate-in fade-in duration-1000">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Instructor Dashboard</h1>
            <p className="text-cyan-400/70 font-mono text-sm">System Status: ONLINE | Monitoring {myResults.length} student submissions</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={exportResultsCSV}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all transform hover:-translate-y-1"
            >
              <FileSpreadsheet size={20} /> Export Excel/CSV
            </button>
            <button 
              onClick={() => setCurrentView('create_exam')}
              className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-cyan-50 text-black rounded-xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all transform hover:-translate-y-1"
            >
              <Plus size={20} /> Create New Exam
            </button>
          </div>
        </div>

        <div className="flex gap-6 mb-8 border-b border-white/10 pb-2 overflow-x-auto custom-scrollbar">
          <button onClick={() => setActiveTab('overview')} className={`font-bold pb-3 px-2 border-b-2 whitespace-nowrap transition-all ${activeTab === 'overview' ? 'border-cyan-400 text-cyan-400 shadow-[0_10px_20px_-10px_rgba(6,182,212,0.5)]' : 'border-transparent text-white/40 hover:text-white'}`}>Overview & Analytics</button>
          <button onClick={() => setActiveTab('exams')} className={`font-bold pb-3 px-2 border-b-2 whitespace-nowrap transition-all ${activeTab === 'exams' ? 'border-purple-400 text-purple-400 shadow-[0_10px_20px_-10px_rgba(168,85,247,0.5)]' : 'border-transparent text-white/40 hover:text-white'}`}>Manage Exams ({myExams.length})</button>
          <button onClick={() => setActiveTab('students')} className={`font-bold pb-3 px-2 border-b-2 whitespace-nowrap transition-all ${activeTab === 'students' ? 'border-emerald-400 text-emerald-400 shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)]' : 'border-transparent text-white/40 hover:text-white'}`}>Manage Students ({allStudents.length})</button>
        </div>

        {activeTab === 'overview' && (
          <div className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Activity size={80}/></div>
                <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Total Exams Created</h3>
                <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{myExams.length}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users size={80}/></div>
                <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Total Student Submissions</h3>
                <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">{myResults.length}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Target size={80}/></div>
                <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Global Average Score</h3>
                <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">{averageTotalScore}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <BarChart3 className="text-cyan-400"/> Average Score per Exam
                </h2>
                <div className="h-[300px] w-full min-h-[300px] min-w-[400px]">
                  {myExams.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={400} minHeight={300}>
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="name" stroke="#ffffff50" axisLine={false} tickLine={false} tick={{fontSize: 12}} dy={10} />
                        <YAxis stroke="#ffffff50" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <RechartsTooltip 
                          cursor={{fill: '#ffffff05'}}
                          contentStyle={{ backgroundColor: '#000000e0', border: '1px solid #06b6d4', borderRadius: '12px', color: '#fff' }}
                          itemStyle={{ color: '#06b6d4' }}
                        />
                        <Bar dataKey="avgScore" name="Avg Score (%)" radius={[6, 6, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#colorGradient)`} />
                          ))}
                        </Bar>
                        <defs>
                          <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-white/30 font-mono text-sm border border-dashed border-white/10 rounded-xl">NO DATA AVAILABLE</div>
                  )}
                </div>
              </div>

              <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Users className="text-purple-400"/> Recent Submissions Log
                </h2>
                <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                  {myResults.length === 0 ? (
                    <p className="text-white/30 text-sm text-center mt-10">No students have taken your exams yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {myResults.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(result => {
                        const student = users.find(u => u.id === result.studentId);
                        const exam = exams.find(e => e.id === result.examId);
                        const percentage = Math.round((result.score / result.totalQuestions) * 100);
                        return (
                          <div key={result.id} className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors">
                            <div>
                              <p className="text-white font-medium text-sm">
                                {student ? student.name : 'Unknown Student'} 
                                <span className="text-cyan-400/60 font-mono text-xs ml-2">[{student?.studentId}]</span>
                              </p>
                              <p className="text-white/40 text-xs truncate w-48 mt-0.5">
                                {exam ? exam.title : 'Deleted Exam'} • <span className="text-purple-400/60">{student?.department}</span>
                              </p>
                            </div>
                            <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${percentage >= 50 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                              {percentage}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-white mb-6">Manage Examinations</h2>
            <div className="space-y-4">
              {myExams.length === 0 ? (
                <p className="text-white/30 text-center py-10">You have no active exams. Create one to get started.</p>
              ) : (
                myExams.map(exam => (
                  <div key={exam.id} className="flex justify-between items-center bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-purple-500/50 transition-colors">
                    <div>
                      <h3 className="text-lg font-bold text-white">{exam.title}</h3>
                      <p className="text-sm text-white/50">{exam.department} • {exam.duration} Minutes • {exam.questions.length} Questions</p>
                    </div>
                    <button onClick={() => deleteExam(exam.id)} className="p-3 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all" title="Delete Exam">
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-white mb-6">Student Directory</h2>
            <div className="space-y-4">
              {allStudents.length === 0 ? (
                <p className="text-white/30 text-center py-10">No students registered in the system yet.</p>
              ) : (
                allStudents.map(student => {
                  const sResults = results.filter(r => r.studentId === student.id);
                  return (
                    <div key={student.id} className="flex justify-between items-center bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-emerald-500/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                          {student.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {student.name} <span className="text-xs bg-white/10 px-2 py-1 rounded-md font-mono text-cyan-400">{student.studentId}</span>
                          </h3>
                          <p className="text-sm text-white/50">{student.department} • {sResults.length} Exams Taken</p>
                        </div>
                      </div>
                      <button onClick={() => deleteStudent(student.id)} className="p-3 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all" title="Remove Student">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const StudentDashboard = () => {
    if (!currentUser) return null;
    const myExams = exams.filter(e => e.department === currentUser.department || e.department === 'All');
    const myResults = results.filter(r => r.studentId === currentUser.id);
    
    return (
      <div className="pt-28 pb-12 px-6 max-w-7xl mx-auto animate-in fade-in duration-1000">
        <div className="mb-12">
          <h1 className="text-4xl font-black text-white mb-2">Welcome, {currentUser.name}</h1>
          <p className="text-cyan-400/70 font-mono text-sm">ID: {currentUser.studentId} | Dept: {currentUser.department}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="text-cyan-400"/> Available Examinations
            </h2>
            
            {myExams.length === 0 ? (
              <div className="bg-white/5 border border-dashed border-white/20 rounded-3xl p-10 text-center">
                <BookOpen size={48} className="mx-auto text-white/20 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Exams Scheduled</h3>
                <p className="text-white/50">Your department currently has no active exams.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {myExams.map(exam => {
                  const hasTaken = myResults.find(r => r.examId === exam.id);
                  return (
                    <div key={exam.id} className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-white/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{exam.title}</h3>
                          {hasTaken && <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1"><CheckCircle size={12}/> Completed</span>}
                        </div>
                        <p className="text-white/60 text-sm mb-4 line-clamp-2">{exam.description}</p>
                        <div className="flex gap-4 text-xs font-mono text-cyan-400/70">
                          <span className="flex items-center gap-1"><Clock size={14}/> {exam.duration} Min</span>
                          <span className="flex items-center gap-1"><FileText size={14}/> {exam.questions.length} Qs</span>
                        </div>
                      </div>
                      
                      {!hasTaken ? (
                        <button 
                          onClick={() => { setActiveExam(exam); setCurrentView('take_exam'); }}
                          className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-cyan-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] whitespace-nowrap flex items-center justify-center gap-2"
                        >
                          Start Exam <Play size={16} fill="currentColor"/>
                        </button>
                      ) : (
                        <div className="px-6 py-3 bg-white/5 text-white/50 font-bold rounded-xl border border-white/5 whitespace-nowrap text-center">
                          Score: {hasTaken.score}/{hasTaken.totalQuestions}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="text-purple-400"/> Your Progress
            </h2>
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="text-center pb-6 border-b border-white/10 mb-6">
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
                  {myResults.length > 0 
                    ? Math.round(myResults.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / myResults.length * 100) 
                    : 0}%
                </div>
                <p className="text-white/50 text-sm font-bold uppercase tracking-wider">Average Score</p>
              </div>
              <div className="space-y-4">
                {myResults.length === 0 ? (
                  <p className="text-center text-white/30 text-sm">No results yet.</p>
                ) : (
                  myResults.map((res, i) => {
                    const ex = exams.find(e => e.id === res.examId);
                    return (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-white/70 truncate pr-4">{ex ? ex.title : 'Deleted Exam'}</span>
                        <span className="font-mono font-bold text-cyan-400">{res.score}/{res.totalQuestions}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CreateExamView = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState('60');
    const [department, setDepartment] = useState('All');
    const [questions, setQuestions] = useState<Question[]>([]);
    
    // AI Modal State
    const [showAIModal, setShowAIModal] = useState(false);
    const [questionsText, setQuestionsText] = useState('');
    const [answerKeyText, setAnswerKeyText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const addManualQuestion = () => {
      setQuestions([...questions, { text: '', options: ['', '', '', ''], correct: 0 }]);
    };

    const updateQuestion = (index: number, field: keyof Question, value: any) => {
      const newQs = [...questions];
      (newQs[index] as any)[field] = value;
      setQuestions(newQs);
    };

    const updateOption = (qIndex: number, oIndex: number, value: string) => {
      const newQs = [...questions];
      newQs[qIndex].options[oIndex] = value;
      setQuestions(newQs);
    };

    const removeQuestion = (index: number) => {
      setQuestions(questions.filter((_, i) => i !== index));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => setter((e.target as FileReader)?.result as string);
        reader.readAsText(file);
      }
    };

    const analyzeAndAddQuestions = async () => {
      if (!questionsText.trim()) {
        showModal('Missing Content', 'Please provide the document containing the questions.', 'error');
        return;
      }
      
      setIsGenerating(true);
      try {
        const payload = {
          contents: [{ 
            parts: [{ 
              text: `I need to turn this document into a digital test. \n\nHere are the questions:\n${questionsText}\n\nHere is the answer key (if provided):\n${answerKeyText}\n\nPlease extract as many questions as possible, match them to the correct answers, and format them for the digital test.` 
            }] 
          }],
          systemInstruction: { 
            parts: [{ 
              text: "You are an expert exam digitizer. Your job is to read raw text containing multiple choice questions, cross-reference them with an answer key (if provided), and output ONLY a valid JSON array of objects. Each object must have this exact structure: {\"text\": \"Question text\", \"options\": [\"Option 1\", \"Option 2\", \"Option 3\", \"Option 4\"], \"correct\": 0}. 'correct' is the integer index (0-3) of the correct answer." 
            }] 
          },
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  text: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  correct: { type: "INTEGER" }
                },
                required: ["text", "options", "correct"]
              }
            }
          }
        };

        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
        if (!apiKey) {
          showModal('AI Not Configured', 'AI question extraction requires a Google Gemini API key. Set NEXT_PUBLIC_GEMINI_API_KEY in your environment.', 'error');
          setIsGenerating(false);
          return;
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const result = await response.json();
        const jsonString = result?.candidates?.[0]?.content?.parts?.[0]?.text || result?.candidates?.[0]?.content?.[0]?.text;

        if (!jsonString) {
          throw new Error(`Invalid response from API: ${JSON.stringify(result)}`);
        }

        const generatedQs = JSON.parse(jsonString);
        if (!Array.isArray(generatedQs) || generatedQs.some(q => !q?.text || !q?.options || typeof q.correct !== 'number')) {
          throw new Error('API returned invalid question structure.');
        }

        setQuestions([...questions, ...generatedQs]);
        setShowAIModal(false);
        setQuestionsText('');
        setAnswerKeyText('');
        showModal('AI Processing Complete', `Successfully extracted and added ${generatedQs.length} questions to your exam!`, 'success');
      } catch (error) {
        console.error(error);
        showModal('Processing Failed', 'The AI engine encountered an error parsing the text. Please check the document format or try again.', 'error');
      } finally {
        setIsGenerating(false);
      }
    };

    const saveExam = async () => {
      if (!currentUser) return;
      if (!title || questions.length === 0) {
        showModal('Error', 'Please add a title and at least one question.', 'error');
        return;
      }

      const newExam: Exam = {
        id: 'exam-' + Date.now(),
        teacherId: currentUser.id,
        title,
        description,
        duration: parseInt(duration),
        department,
        questions,
        createdAt: new Date().toISOString()
      };

      try {
        const { error } = await supabase
          .from('exams')
          .insert([newExam]);

        if (error) throw error;

        setExams([...exams, newExam]);
        showModal('Success', 'Exam created and published successfully!', 'success', () => setCurrentView('teacher_dash'));
      } catch (err) {
        console.error('Error saving exam:', err);
        showModal('Error', 'Failed to save exam. Please try again.', 'error');
      }
    };

    return (
      <div className="pt-28 pb-12 px-6 max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-700">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setCurrentView('teacher_dash')} className="text-white/50 hover:text-white transition-colors">
            <ChevronRight className="rotate-180" size={24}/>
          </button>
          <h1 className="text-3xl font-black text-white">Create New Examination</h1>
        </div>

        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 mb-8 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Exam Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none" placeholder="e.g. Midterm Assessment" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Description / Instructions</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none h-24" placeholder="Brief instructions for students..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Target Department</label>
              <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none">
                <option value="All">All Departments</option>
                <option value="Accounting">Accounting</option>
                <option value="Management">Management</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Duration (Minutes)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="text-cyan-400"/> Questions ({questions.length})</h2>
          <div className="flex gap-3">
            <button onClick={() => setShowAIModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-bold shadow-lg transition-all text-sm">
              <Brain size={16} /> AI Auto-Add
            </button>
            <button onClick={addManualQuestion} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-all text-sm">
              <Plus size={16} /> Manual Add
            </button>
          </div>
        </div>

        <div className="space-y-6 mb-12">
          {questions.map((q, qIndex) => (
            <div key={qIndex} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative group">
              <button onClick={() => removeQuestion(qIndex)} className="absolute top-4 right-4 text-white/20 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={20}/>
              </button>
              <div className="mb-4 pr-8">
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Question {qIndex + 1}</label>
                <input type="text" value={q.text} onChange={e => updateQuestion(qIndex, 'text', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-cyan-400 focus:outline-none" placeholder="Enter question text..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {q.options.map((opt, oIndex) => (
                  <div key={oIndex} className={`flex items-center gap-3 p-2 rounded-lg border ${q.correct === oIndex ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-black/40'}`}>
                    <input type="radio" name={`correct-${qIndex}`} checked={q.correct === oIndex} onChange={() => updateQuestion(qIndex, 'correct', oIndex)} className="w-4 h-4 accent-emerald-500" />
                    <input type="text" value={opt} onChange={e => updateOption(qIndex, oIndex, e.target.value)} className="w-full bg-transparent text-white text-sm focus:outline-none" placeholder={`Option ${oIndex + 1}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-3xl">
              <p className="text-white/40">No questions added yet. Use AI or add manually.</p>
            </div>
          )}
        </div>

        <button onClick={saveExam} className="w-full py-4 bg-white text-black font-black text-lg rounded-xl hover:bg-cyan-50 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2">
          <Save size={24}/> Publish Examination
        </button>

        {showAIModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#11111a] border border-white/10 rounded-3xl p-8 max-w-3xl w-full relative shadow-2xl animate-in zoom-in-95">
              <button onClick={() => setShowAIModal(false)} className="absolute top-6 right-6 text-white/50 hover:text-white">
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <Brain className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">AI Question Analyzer</h2>
                  <p className="text-white/50 text-sm">Paste text or upload documents to auto-extract questions.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white/70 uppercase tracking-wider">1. Questions Document</label>
                    <label className="cursor-pointer text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white transition-colors">
                      <Upload size={12}/> Upload File
                      <input type="file" accept=".txt,.csv,.md" className="hidden" onChange={(e) => handleFileUpload(e, setQuestionsText)} />
                    </label>
                  </div>
                  <textarea 
                    value={questionsText} 
                    onChange={e => setQuestionsText(e.target.value)} 
                    className="w-full h-48 bg-black/50 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-purple-500 focus:outline-none custom-scrollbar placeholder-white/20" 
                    placeholder="Paste your 100+ questions here...&#10;&#10;Example:&#10;1. What is the capital of France?&#10;A) London&#10;B) Paris&#10;C) Rome&#10;D) Berlin"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white/70 uppercase tracking-wider">2. Answer Key (Optional)</label>
                    <label className="cursor-pointer text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white transition-colors">
                      <Upload size={12}/> Upload File
                      <input type="file" accept=".txt,.csv,.md" className="hidden" onChange={(e) => handleFileUpload(e, setAnswerKeyText)} />
                    </label>
                  </div>
                  <textarea 
                    value={answerKeyText} 
                    onChange={e => setAnswerKeyText(e.target.value)} 
                    className="w-full h-48 bg-black/50 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-purple-500 focus:outline-none custom-scrollbar placeholder-white/20" 
                    placeholder="Paste the answer key here if it's separate...&#10;&#10;Example:&#10;1. B&#10;2. A&#10;3. C"
                  />
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3 mb-6 text-sm text-blue-200">
                <AlertCircle size={18} className="mt-0.5 text-blue-400 shrink-0"/>
                <p>The AI will read both fields, match the questions to the answers, format them into multiple-choice blocks, and inject them directly into your exam.</p>
              </div>

              <button 
                onClick={analyzeAndAddQuestions} 
                disabled={isGenerating || !questionsText}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Analyzing Data...</>
                ) : (
                  <><Brain size={20} /> Analyze & Auto-Add to Exam</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TakeExamView = () => {
    if (!activeExam) return null;
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [timeLeft, setTimeLeft] = useState(activeExam.duration * 60);

    useEffect(() => {
      if (timeLeft <= 0) { submitExam(); return; }
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    }, [timeLeft]);

    const submitExam = async () => {
      if (!currentUser || !activeExam) return;

      let score = 0;
      activeExam.questions.forEach((q, idx) => { if (answers[idx] === q.correct) score++; });

      const newResult: Result = {
        id: 'r-' + Date.now(),
        studentId: currentUser.id,
        examId: activeExam.id,
        score,
        totalQuestions: activeExam.questions.length,
        date: new Date().toISOString()
      };

      try {
        const { error } = await supabase
          .from('results')
          .insert([newResult]);

        if (error) throw error;

        setResults([...results, newResult]);
        const percentage = Math.round((score / activeExam.questions.length) * 100);
        showModal('Exam Completed', `Your Score: ${score}/${activeExam.questions.length} (${percentage}%)`, percentage >= 50 ? 'success' : 'error', () => {
          setActiveExam(null);
          setCurrentView('student_dash');
        });
      } catch (err) {
        console.error('Error submitting exam:', err);
        showModal('Error', 'Failed to submit exam. Please try again.', 'error');
      }
    };

    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const q = activeExam.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / activeExam.questions.length) * 100;

    return (
      <div className="pt-28 pb-12 px-6 max-w-4xl mx-auto min-h-screen flex flex-col animate-in fade-in">
        <div className="flex justify-between items-center mb-8 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{activeExam.title}</h1>
            <p className="text-white/50 text-sm">Question {currentQuestion + 1} of {activeExam.questions.length}</p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-xl font-mono text-xl text-cyan-400 border border-white/5 shadow-inner">
            <Clock size={20} className="text-white/50"/> {formatTime(timeLeft)}
          </div>
        </div>

        <div className="w-full h-1 bg-white/10 rounded-full mb-10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" style={{width: `${progress}%`}}></div>
        </div>

        <div className="flex-grow">
          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl mb-8">
            <h2 className="text-2xl text-white font-medium mb-10 leading-relaxed">{q.text}</h2>
            <div className="space-y-4">
              {q.options.map((opt, idx) => (
                <button 
                  key={idx}
                  onClick={() => setAnswers({...answers, [currentQuestion]: idx})}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 ${answers[currentQuestion] === idx ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30'}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${answers[currentQuestion] === idx ? 'border-cyan-400' : 'border-white/30'}`}>
                    {answers[currentQuestion] === idx && <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>}
                  </div>
                  <span className="text-white text-lg">{opt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/10">
          <button 
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion(c => c - 1)}
            className="px-6 py-3 text-white/50 font-bold hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          
          {currentQuestion === activeExam.questions.length - 1 ? (
            <button 
              onClick={submitExam}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all transform hover:-translate-y-1 flex items-center gap-2"
            >
              Submit Exam <CheckCircle size={20}/>
            </button>
          ) : (
            <button 
              onClick={() => setCurrentQuestion(c => c + 1)}
              className="px-8 py-4 bg-white text-black font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-cyan-50 transition-all transform hover:-translate-y-1 flex items-center gap-2"
            >
              Next Question <ChevronRight size={20}/>
            </button>
          )}
        </div>
      </div>
    );
  };

  const Modal = () => {
    if (!modal.isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-[#11111a] border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 ${modal.type === 'error' ? 'bg-rose-500' : modal.type === 'success' ? 'bg-emerald-500' : 'bg-cyan-500'}`}></div>
          <h2 className="text-2xl font-black text-white mb-3">{modal.title}</h2>
          <p className="text-white/70 mb-8 leading-relaxed">{modal.message}</p>
          <button onClick={closeModal} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all">
            Understood
          </button>
        </div>
      </div>
    );
  };

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30">
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />

      {/* Loading State */}
      {loading && (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Loading Union Vision Portal</h2>
            <p className="text-cyan-400/70">Connecting to database...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <AlertCircle size={64} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
            <p className="text-red-400/70 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Only show when loaded and no error */}
      {!loading && !error && (
        <>
          {currentView !== 'auth' && currentView !== 'take_exam' && (
            <nav className="fixed top-0 w-full bg-black/50 backdrop-blur-xl border-b border-white/10 z-40 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
              <GraduationCap size={20} color="white" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight hidden md:block">Union Vision</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
              <span className="text-xs font-mono text-emerald-400">System Secure</span>
            </div>
            <button 
              onClick={() => { setCurrentUser(null); setCurrentView('auth'); }}
              className="flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white transition-colors"
            >
              <LogOut size={16} /> Disconnect
            </button>
          </div>
        </nav>
      )}

      {currentView === 'auth' && <AuthView />}
      {currentView === 'teacher_dash' && <TeacherDashboard />}
      {currentView === 'student_dash' && <StudentDashboard />}
      {currentView === 'create_exam' && <CreateExamView />}
      {currentView === 'take_exam' && <TakeExamView />}
        </>
      )}

      <Modal />
    </div>
  );
}