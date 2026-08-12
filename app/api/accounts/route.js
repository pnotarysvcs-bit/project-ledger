import { NextResponse } from 'next/server';
import { supabaseRequest } from '../../../src/supabase-server.js';

const VALID_KINDS = new Set(['checking', 'savings']);

function normalizeAccount(input = {}) {
  const institution = String(input.institution ?? '').trim();
  const kind = String(input.kind ?? '').trim().toLowerCase();

  if (!institution) throw new Error('Bank name is required.');
  if (!VALID_KINDS.has(kind)) throw new Error('A valid account type is required.');

  return { institution, kind };
}

export async function GET() {
  try {
    const accounts = await supabaseRequest(
      'ledger_accounts?select=id,institution,kind,is_active&is_active=eq.true&order=institution.asc',
    );
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const account = normalizeAccount(await request.json());
    const rows = await supabaseRequest('ledger_accounts?select=id,institution,kind,is_active', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: account,
    });
    return NextResponse.json({ account: rows[0] }, { status: 201 });
  } catch (error) {
    const duplicate = error.message.includes('duplicate key');
    return NextResponse.json(
      { error: duplicate ? 'That active bank account already exists.' : error.message },
      { status: duplicate ? 409 : 400 },
    );
  }
}

export async function PATCH(request) {
  try {
    const input = await request.json();
    const id = String(input.id ?? '').trim();
    if (!id) throw new Error('Account id is required.');

    const account = normalizeAccount(input);
    const rows = await supabaseRequest(`ledger_accounts?id=eq.${encodeURIComponent(id)}&is_active=eq.true&select=id,institution,kind,is_active`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: account,
    });

    if (!rows?.length) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    return NextResponse.json({ account: rows[0] });
  } catch (error) {
    const duplicate = error.message.includes('duplicate key');
    return NextResponse.json(
      { error: duplicate ? 'That active bank account already exists.' : error.message },
      { status: duplicate ? 409 : 400 },
    );
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    if (!id) throw new Error('Account id is required.');

    const rows = await supabaseRequest(`ledger_accounts?id=eq.${encodeURIComponent(id)}&select=id,institution,kind,is_active`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: { is_active: false, archived_at: new Date().toISOString() },
    });

    if (!rows?.length) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    return NextResponse.json({ account: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
