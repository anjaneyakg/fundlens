import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { createSupabaseClient } from '../lib/supabaseClient'

const ExpenseContext = createContext(null)

export function useExpense() {
  const ctx = useContext(ExpenseContext)
  if (!ctx) throw new Error('useExpense must be used inside ExpenseProvider')
  return ctx
}

const DEFAULT_CATEGORIES = [
  { category_name: 'Groceries',            icon_code: '🛒', colour_hex: '#4CAF50', display_order: 1  },
  { category_name: 'Dining & Food Delivery',icon_code: '🍽️', colour_hex: '#FF9800', display_order: 2  },
  { category_name: 'Transport',             icon_code: '🚗', colour_hex: '#2196F3', display_order: 3  },
  { category_name: 'Housing & Rent',        icon_code: '🏠', colour_hex: '#9C27B0', display_order: 4  },
  { category_name: 'Utilities',             icon_code: '⚡', colour_hex: '#607D8B', display_order: 5  },
  { category_name: 'Medical & Health',      icon_code: '💊', colour_hex: '#F44336', display_order: 6  },
  { category_name: 'Shopping',              icon_code: '🛍️', colour_hex: '#E91E63', display_order: 7  },
  { category_name: 'Entertainment',         icon_code: '🎬', colour_hex: '#00BCD4', display_order: 8  },
  { category_name: 'Subscriptions',         icon_code: '📱', colour_hex: '#3F51B5', display_order: 9  },
  { category_name: 'School & Education',    icon_code: '📚', colour_hex: '#795548', display_order: 10 },
  { category_name: 'Financial Goals',       icon_code: '💰', colour_hex: '#1A3C6E', display_order: 11 },
  { category_name: 'Repair & Maintenance',  icon_code: '🔧', colour_hex: '#FF5722', display_order: 12 },
  { category_name: 'Personal Care',         icon_code: '💆', colour_hex: '#9E9E9E', display_order: 13 },
  { category_name: 'Travel',                icon_code: '✈️', colour_hex: '#009688', display_order: 14 },
  { category_name: 'Gifts & Occasions',     icon_code: '🎁', colour_hex: '#673AB7', display_order: 15 },
  { category_name: 'Miscellaneous',         icon_code: '📌', colour_hex: '#9E9E9E', display_order: 16 },
  { category_name: 'Untracked CC Spend',    icon_code: '💳', colour_hex: '#F44336', display_order: 17 },
]

export function ExpenseProvider({ children }) {
  const { user, token } = useAuth()

  const [transactions,    setTransactions]    = useState([])
  const [categories,      setCategories]      = useState([])
  const [paymentSources,  setPaymentSources]  = useState([])
  const [recurringItems,  setRecurringItems]  = useState([])
  const [currencyPrefs,   setCurrencyPrefs]   = useState([])
  const [friends,         setFriends]         = useState([])
  const [splits,          setSplits]          = useState([])
  const [familyMembers,   setFamilyMembers]   = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)

  const expenseCategories = categories.filter(c => c.category_type !== 'income' && c.is_active !== false)
  const incomeHeads       = categories.filter(c => c.category_type === 'income' && c.is_active !== false)

  const sb = useCallback(() => {
    if (!token) return null
    return createSupabaseClient(token)
  }, [token])

  const loadAll = useCallback(async () => {
    if (!user || !token) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const client = createSupabaseClient(token)

      const [txnRes, catRes, srcRes, recRes, cpRes] = await Promise.all([
        client.from('expense_transactions').select('*').eq('user_id', user.uid).order('txn_date', { ascending: false }).order('created_at', { ascending: false }),
        client.from('expense_categories').select('*').eq('user_id', user.uid).order('display_order'),
        client.from('expense_payment_sources').select('*').eq('user_id', user.uid).order('display_order'),
        client.from('expense_recurring').select('*').eq('user_id', user.uid).order('due_date_next'),
        client.from('expense_currency_prefs').select('*').eq('user_id', user.uid).order('display_order'),
      ])

      if (txnRes.error) throw txnRes.error
      if (catRes.error) throw catRes.error
      if (srcRes.error) throw srcRes.error
      if (recRes.error) throw recRes.error
      if (cpRes.error) console.error('ExpenseContext loadAll currency_prefs error:', cpRes.error)

      setTransactions(txnRes.data || [])
      setRecurringItems(recRes.data || [])
      setCurrencyPrefs(cpRes.data || [])

      let cats = catRes.data || []
      let srcs = srcRes.data || []

      // Auto-insert defaults on first open
      if (cats.length === 0) {
        cats = await insertDefaultCategories(client, user.uid)
      }
      if (srcs.length === 0) {
        srcs = await insertDefaultSource(client, user.uid)
      }

      setCategories(cats)
      setPaymentSources(srcs)

      const { data: fmData, error: fmErr } = await client
        .from('expense_family_members')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (fmErr) console.error('ExpenseContext loadAll family_members error:', fmErr?.message, fmErr?.code)
      setFamilyMembers(fmData || [])

      const { data: friendsData, error: friendsErr } = await client
        .from('expense_friends')
        .select('*')
        .eq('is_active', true)
        .order('friend_name')
      if (friendsErr) console.error('ExpenseContext loadAll friends error:', friendsErr?.message, friendsErr?.code)
      setFriends(friendsData || [])

      const { data: splitsData, error: splitsErr } = await client
        .from('expense_splits')
        .select('*')
      if (splitsErr) console.error('ExpenseContext loadAll splits error:', splitsErr)
      setSplits(splitsData || [])
    } catch (err) {
      console.error('ExpenseContext loadAll error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, token])

  useEffect(() => {
    if (user && token) loadAll()
    else { setTransactions([]); setCategories([]); setPaymentSources([]); setRecurringItems([]); setFriends([]); setSplits([]); setFamilyMembers([]); setLoading(false) }
  }, [user, token, loadAll])

  async function insertDefaultCategories(client, uid) {
    const rows = DEFAULT_CATEGORIES.map(c => ({
      ...c,
      user_id:    uid,
      is_default: true,
      is_active:  true,
    }))
    const { data, error: err } = await client
      .from('expense_categories')
      .insert(rows)
      .select()
    if (err) { console.error('ExpenseContext insertDefaultCategories error:', err); return [] }
    return data || []
  }

  async function insertDefaultSource(client, uid) {
    const { data, error: err } = await client
      .from('expense_payment_sources')
      .insert([{ user_id: uid, source_name: 'Cash', source_type: 'cash', is_default: true, is_active: true, display_order: 0 }])
      .select()
    if (err) { console.error('ExpenseContext insertDefaultSource error:', err); return [] }
    return data || []
  }

  // ── Transactions ──────────────────────────────────────────────────────────────

  async function addTransaction(payload) {
    const client = sb()
    if (!client || !user) return
    const row = { ...payload, user_id: user.uid, logged_by: user.uid }
    const { data, error: err } = await client.from('expense_transactions').insert([row]).select()
    if (err) { console.error('addTransaction error:', err); throw err }
    setTransactions(prev => [data[0], ...prev])
    return data[0]
  }

  async function updateTransaction(id, patch) {
    const client = sb()
    if (!client) return
    const { data, error: err } = await client
      .from('expense_transactions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.uid)
      .select()
    if (err) { console.error('updateTransaction error:', err); throw err }
    setTransactions(prev => prev.map(t => t.id === id ? data[0] : t))
    return data[0]
  }

  async function deleteTransaction(id) {
    const client = sb()
    if (!client) return
    const { error: err } = await client
      .from('expense_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.uid)
    if (err) { console.error('deleteTransaction error:', err); throw err }
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  // ── Categories ────────────────────────────────────────────────────────────────

  async function addCategory(payload) {
    const client = sb()
    if (!client || !user) return
    const row = { category_type: 'expense', ...payload, user_id: user.uid, is_default: false, is_active: true }
    const { data, error: err } = await client.from('expense_categories').insert([row]).select()
    if (err) { console.error('addCategory error:', err); throw err }
    setCategories(prev => [...prev, data[0]])
    return data[0]
  }

  async function updateCategory(id, patch) {
    const client = sb()
    if (!client) return
    const { data, error: err } = await client
      .from('expense_categories')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.uid)
      .select()
    if (err) { console.error('updateCategory error:', err); throw err }
    setCategories(prev => prev.map(c => c.id === id ? data[0] : c))
    return data[0]
  }

  // ── Payment sources ───────────────────────────────────────────────────────────

  async function addPaymentSource(payload) {
    const client = sb()
    if (!client || !user) return
    const row = { ...payload, user_id: user.uid, is_active: true }
    const { data, error: err } = await client.from('expense_payment_sources').insert([row]).select()
    if (err) { console.error('addPaymentSource error:', err); throw err }
    setPaymentSources(prev => [...prev, data[0]])
    return data[0]
  }

  async function updatePaymentSource(id, patch) {
    const client = sb()
    if (!client) return
    const { data, error: err } = await client
      .from('expense_payment_sources')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.uid)
      .select()
    if (err) { console.error('updatePaymentSource error:', err); throw err }
    setPaymentSources(prev => prev.map(s => s.id === id ? data[0] : s))
    return data[0]
  }

  // ── Recurring ─────────────────────────────────────────────────────────────────

  async function addRecurringItem(payload) {
    const client = sb()
    if (!client || !user) return
    const row = { ...payload, user_id: user.uid, is_active: true }
    const { data, error: err } = await client.from('expense_recurring').insert([row]).select()
    if (err) { console.error('addRecurringItem error:', err); throw err }
    setRecurringItems(prev => [...prev, data[0]])
    return data[0]
  }

  async function updateRecurringItem(id, patch) {
    const client = sb()
    if (!client) return
    const { data, error: err } = await client
      .from('expense_recurring')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.uid)
      .select()
    if (err) { console.error('updateRecurringItem error:', err); throw err }
    setRecurringItems(prev => prev.map(r => r.id === id ? data[0] : r))
    return data[0]
  }

  async function deleteRecurringItem(id) {
    const client = sb()
    if (!client) return
    const { error: err } = await client
      .from('expense_recurring')
      .delete()
      .eq('id', id)
      .eq('user_id', user.uid)
    if (err) { console.error('deleteRecurringItem error:', err); throw err }
    setRecurringItems(prev => prev.filter(r => r.id !== id))
  }

  // ── Currency prefs ────────────────────────────────────────────────────────────

  async function addCurrencyPref(payload) {
    const client = sb()
    if (!client || !user) return
    const row = { ...payload, user_id: user.uid }
    const { data, error: err } = await client.from('expense_currency_prefs').insert([row]).select()
    if (err) { console.error('addCurrencyPref error:', err); throw err }
    setCurrencyPrefs(prev => [...prev, data[0]])
    return data[0]
  }

  async function updateCurrencyRate(id, newRate) {
    const client = sb()
    if (!client) return
    const { data, error: err } = await client
      .from('expense_currency_prefs')
      .update({ fx_rate_to_inr: newRate, rate_updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.uid)
      .select()
    if (err) { console.error('updateCurrencyRate error:', err); throw err }
    setCurrencyPrefs(prev => prev.map(c => c.id === id ? data[0] : c))
    return data[0]
  }

  async function removeCurrencyPref(id) {
    const client = sb()
    if (!client) return
    const { error: err } = await client
      .from('expense_currency_prefs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.uid)
    if (err) { console.error('removeCurrencyPref error:', err); throw err }
    setCurrencyPrefs(prev => prev.filter(c => c.id !== id))
  }

  // ── Friends ───────────────────────────────────────────────────────────────────

  // ── Family members ────────────────────────────────────────────────────────────

  async function addFamilyMember(name, relationship) {
    const client = sb()
    if (!client || !user) return
    const { error: err } = await client
      .from('expense_family_members')
      .insert([{ user_id: user.uid, name: name.trim(), relationship: relationship || null, is_active: true }])
    if (err) { console.error('addFamilyMember error:', err.message, err.code, err.details); throw err }
    const { data, error: reloadErr } = await client.from('expense_family_members').select('*').eq('is_active', true).order('name')
    if (reloadErr) console.error('addFamilyMember reload error:', reloadErr.message)
    setFamilyMembers(data || [])
  }

  async function removeFamilyMember(id) {
    const client = sb()
    if (!client) return
    const { error: err } = await client
      .from('expense_family_members')
      .update({ is_active: false })
      .eq('id', id)
    if (err) { console.error('removeFamilyMember error:', err.message, err.code); throw err }
    const { data, error: reloadErr } = await client.from('expense_family_members').select('*').eq('is_active', true).order('name')
    if (reloadErr) console.error('removeFamilyMember reload error:', reloadErr.message)
    setFamilyMembers(data || [])
  }

  async function addFriend(friend_name, nickname) {
    const client = sb()
    if (!client || !user) return
    const { error: err } = await client
      .from('expense_friends')
      .insert([{ user_id: user.uid, friend_name: friend_name.trim(), nickname: nickname?.trim() || null, is_active: true }])
    if (err) { console.error('addFriend error:', err.message, 'code:', err.code, 'details:', err.details); throw err }
    const { data, error: reloadErr } = await client.from('expense_friends').select('*').eq('is_active', true).order('friend_name')
    if (reloadErr) console.error('addFriend reload error:', reloadErr.message)
    setFriends(data || [])
  }

  async function removeFriend(id) {
    const client = sb()
    if (!client) return
    const { error: err } = await client
      .from('expense_friends')
      .update({ is_active: false })
      .eq('id', id)
    if (err) { console.error('removeFriend error:', err); throw err }
    const { data, error: reloadErr } = await client.from('expense_friends').select('*').eq('is_active', true).order('friend_name')
    if (reloadErr) console.error('removeFriend reload error:', reloadErr)
    setFriends(data || [])
  }

  // ── Splits ────────────────────────────────────────────────────────────────────

  async function addSplits(transaction_id, splitRows) {
    const client = sb()
    if (!client || !user) return
    const rows = splitRows.map(r => ({ ...r, transaction_id, user_id: user.uid }))
    const { error: err } = await client
      .from('expense_splits')
      .insert(rows)
    if (err) { console.error('addSplits error:', err); throw err }
    const { data, error: reloadErr } = await client.from('expense_splits').select('*')
    if (reloadErr) console.error('addSplits reload error:', reloadErr)
    setSplits(data || [])
  }

  async function updateSplitStatus(splitId, status) {
    const client = sb()
    if (!client) return
    const patch = {
      settlement_status: status,
      settled_at: status === 'settled' ? new Date().toISOString() : null,
    }
    const { error: err } = await client
      .from('expense_splits')
      .update(patch)
      .eq('id', splitId)
      .eq('user_id', user.uid)
    if (err) { console.error('updateSplitStatus error:', err); throw err }
    setSplits(prev => prev.map(s => s.id === splitId ? { ...s, ...patch } : s))
  }

  const value = {
    transactions, categories, expenseCategories, incomeHeads,
    paymentSources, recurringItems, currencyPrefs,
    familyMembers, addFamilyMember, removeFamilyMember,
    friends, splits,
    loading, error, reload: loadAll,
    addTransaction, updateTransaction, deleteTransaction,
    addCategory, updateCategory,
    addPaymentSource, updatePaymentSource,
    addRecurringItem, updateRecurringItem, deleteRecurringItem,
    addCurrencyPref, updateCurrencyRate, removeCurrencyPref,
    addFriend, removeFriend, addSplits, updateSplitStatus,
  }

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
}
