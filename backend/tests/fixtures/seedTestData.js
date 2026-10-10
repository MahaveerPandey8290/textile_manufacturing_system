// Test fixtures only (used by `npm test` against textile_mill_test). The real app starts empty:
// organisations register themselves and the super admin is created with `npm run platform:admin`.
// This creates a platform admin and four organisations, each in its own schema.
// Everest Textile Mills is the fully loaded demo mill. Its business data is created through
// the real services (not raw inserts), so stock ledgers,
// order statuses, invoices and audit logs are all consistent. Timestamps are then spread
// over the past weeks so dashboards and charts have history to show.
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool, query, runInTenantSchema } from '../../src/db/pool.js';
import { registerOrganization } from '../../src/modules/organizations/organizations.service.js';
import * as inventoryService from '../../src/modules/inventory/inventory.service.js';
import * as ordersService from '../../src/modules/orders/orders.service.js';
import * as productionService from '../../src/modules/production/production.service.js';
import * as qualityService from '../../src/modules/quality/quality.service.js';
import * as dispatchService from '../../src/modules/dispatch/dispatch.service.js';
import * as financeService from '../../src/modules/finance/finance.service.js';
import * as workforceService from '../../src/modules/workforce/workforce.service.js';

export const DEMO_PASSWORD = 'Mill@12345';

// Deterministic pseudo-random numbers so every seed produces the same mill.
let randomState = 20261010;
function random() {
  randomState = (randomState + 0x6d2b79f5) | 0;
  let value = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
const randomBetween = (min, max) => Math.round(min + random() * (max - min));
const pick = (items) => items[Math.floor(random() * items.length)];
const isoDateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

async function insertRows(sql, rows) {
  const inserted = [];
  for (const row of rows) inserted.push((await query(sql, row)).rows[0]);
  return inserted;
}

async function seedEverestMill() {
  // ------------------------------------------------------------ parties
  const buyers = await insertRows(
    `INSERT INTO buyers (company_name, contact_person, phone, email, gst_number, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, company_name`,
    [
      ['Raymond Apparel Ltd', 'Anil Mehta', '+91 98200 11223', 'purchase@raymondapparel.example', '27AAACR1234A1Z5', 'Thane, Maharashtra'],
      ['Arvind Fashions', 'Neha Shah', '+91 98250 44556', 'sourcing@arvindfashions.example', '24AABCA5678B1Z2', 'Ahmedabad, Gujarat'],
      ['Welspun Home Textiles', 'Rohit Agarwal', '+91 99090 77889', 'fabric@welspunhome.example', '24AAACW9012C1Z8', 'Anjar, Gujarat'],
      ['Bombay Dyeing Retail', 'Priya Nair', '+91 98190 33445', 'buying@bombaydyeing.example', '27AAACB3456D1Z1', 'Mumbai, Maharashtra'],
      ['Siyaram Garments', 'Vikas Jain', '+91 98330 66778', 'orders@siyaram.example', '27AAACS7890E1Z4', 'Tarapur, Maharashtra'],
      ['Fabindia Sourcing', 'Kavita Rao', '+91 98110 22113', 'textiles@fabindia.example', '07AAACF2345F1Z9', 'New Delhi'],
    ],
  );
  const suppliers = await insertRows(
    `INSERT INTO suppliers (company_name, contact_person, phone, email, gst_number, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      ['Vardhman Yarns', 'Suresh Kumar', '+91 98140 12345', 'sales@vardhmanyarns.example', '03AAACV1111A1Z1', 'Ludhiana, Punjab'],
      ['Trident Spinning Mills', 'Harpreet Singh', '+91 98720 23456', 'yarn@trident.example', '03AAACT2222B1Z2', 'Barnala, Punjab'],
      ['Nahar Spinning', 'Manoj Gupta', '+91 98150 34567', 'orders@naharspinning.example', '03AAACN3333C1Z3', 'Ludhiana, Punjab'],
      ['Reliance Polyester', 'Deepak Shetty', '+91 98200 45678', 'pfy@reliance.example', '27AAACR4444D1Z4', 'Silvassa'],
    ],
  );

  // ------------------------------------------------------------ users (one per role + a buyer login)
  // The owner was created by sign-up; everyone else signs in with the demo password.
  // Kiran Desai is invited but hasn't set a password yet, to try "First time here?".
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  await query(`INSERT INTO users (full_name, email, role) VALUES ('Kiran Desai', 'kiran@everestmills.in', 'QUALITY_INSPECTOR')`);
  const users = (await query(`SELECT id, role FROM users WHERE role = 'OWNER'`)).rows.concat(await insertRows(
    `INSERT INTO users (full_name, email, password_hash, role, buyer_id, activated_at) VALUES ($1, $2, $3, $4, $5, now()) RETURNING id, role`,
    [
      ['Sunil Patil', 'production@everestmills.in', passwordHash, 'PRODUCTION_MANAGER', null],
      ['Ramesh Yadav', 'store@everestmills.in', passwordHash, 'STORE_MANAGER', null],
      ['Meena Kulkarni', 'quality@everestmills.in', passwordHash, 'QUALITY_INSPECTOR', null],
      ['Ashok Iyer', 'accounts@everestmills.in', passwordHash, 'ACCOUNTANT', null],
      ['Anil Mehta', 'buyer@raymondapparel.example', passwordHash, 'BUYER', buyers[0].id],
    ],
  ));
  const actingAs = (role) => ({ user: { id: users.find((user) => user.role === role).id, role }, ip: '127.0.0.1' });
  const store = actingAs('STORE_MANAGER');
  const floor = actingAs('PRODUCTION_MANAGER');
  const inspector = actingAs('QUALITY_INSPECTOR');
  const accounts = actingAs('ACCOUNTANT');

  // ------------------------------------------------------------ yarn and fabric recipes
  const yarnTypes = await insertRows(
    `INSERT INTO yarn_types (code, name, material, yarn_count, colour, reorder_level_kg) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, code`,
    [
      ['CT-40-RW', 'Combed Cotton 40s', 'Cotton', '40s', 'Raw White', 800],
      ['CT-60-RW', 'Compact Cotton 60s', 'Cotton', '60s', 'Raw White', 600],
      ['CT-30-NV', 'Carded Cotton 30s', 'Cotton', '30s', 'Navy Dyed', 400],
      ['PC-45-RW', 'Poly-Cotton 65/35 45s', 'Poly-Cotton', '45s', 'Raw White', 700],
      ['PV-30-GR', 'Poly-Viscose 30s', 'Poly-Viscose', '30s', 'Grey Melange', 500],
      ['LN-25-NT', 'Linen Blend 25s', 'Linen-Cotton', '25s', 'Natural', 300],
      ['PF-150-BK', 'Polyester Filament 150D', 'Polyester', '150D', 'Black', 400],
      ['CT-20-RW', 'Open-End Cotton 20s', 'Cotton', '20s', 'Raw White', 900],
    ],
  );
  const yarnCost = { 'CT-40-RW': 285, 'CT-60-RW': 340, 'CT-30-NV': 310, 'PC-45-RW': 245, 'PV-30-GR': 230, 'LN-25-NT': 520, 'PF-150-BK': 175, 'CT-20-RW': 215 };
  const fabricTypes = await insertRows(
    `INSERT INTO fabric_types (name, construction, gsm, width_inches, yarn_type_id, yarn_kg_per_meter) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, yarn_type_id, yarn_kg_per_meter`,
    [
      ['Cotton Poplin', '133x72 / 40x40', 110, 58, yarnTypes[0].id, 0.115],
      ['Cotton Voile', '92x88 / 60x60', 75, 58, yarnTypes[1].id, 0.08],
      ['Denim 10 oz', '72x48 / 30x20', 340, 60, yarnTypes[2].id, 0.36],
      ['Poly-Cotton Shirting', '110x80 / 45x45', 120, 58, yarnTypes[3].id, 0.125],
      ['PV Suiting', '96x76 / 30x30', 210, 58, yarnTypes[4].id, 0.22],
      ['Linen Blend', '56x52 / 25x25', 160, 56, yarnTypes[5].id, 0.17],
      ['Cotton Drill', '108x56 / 20x20', 250, 63, yarnTypes[7].id, 0.27],
    ],
  );

  // ------------------------------------------------------------ floor: shifts, machines, workers
  const { rows: shifts } = await query('SELECT id FROM shifts ORDER BY id'); // created at sign-up
  const machineSpecs = [
    ['SP-01', 'Ring Frame LR-6', 'SPINNING', 420, 'Spinning Hall A'],
    ['SP-02', 'Ring Frame LR-6', 'SPINNING', 420, 'Spinning Hall A'],
    ['SP-03', 'Open-End Rotor R-60', 'SPINNING', 380, 'Spinning Hall B'],
    ['WV-01', 'Picanol Air-Jet OmniPlus', 'WEAVING', 520, 'Weaving Shed 1'],
    ['WV-02', 'Picanol Air-Jet OmniPlus', 'WEAVING', 520, 'Weaving Shed 1'],
    ['WV-03', 'Toyota JAT-810', 'WEAVING', 480, 'Weaving Shed 1'],
    ['WV-04', 'Toyota JAT-810', 'WEAVING', 480, 'Weaving Shed 2'],
    ['WV-05', 'Rapier Itema R9500', 'WEAVING', 450, 'Weaving Shed 2'],
    ['WV-06', 'Rapier Itema R9500', 'WEAVING', 450, 'Weaving Shed 2'],
    ['WV-07', 'Sulzer Projectile P7300', 'WEAVING', 400, 'Weaving Shed 3'],
    ['DY-01', 'Jet Dyeing Thies 600', 'DYEING', 650, 'Process House'],
    ['DY-02', 'Jigger Dyeing J-1800', 'DYEING', 500, 'Process House'],
    ['DY-03', 'Continuous Pad-Steam', 'DYEING', 700, 'Process House'],
  ];
  const machines = await insertRows(
    `INSERT INTO machines (code, name, stage, hourly_running_cost, location) VALUES ($1, $2, $3, $4, $5) RETURNING id, code, stage`,
    machineSpecs,
  );
  const machinesByStage = (stage) => machines.filter((machine) => machine.stage === stage);

  const firstNames = ['Ramesh', 'Suresh', 'Ganesh', 'Mahesh', 'Sunita', 'Lakshmi', 'Imran', 'Arjun', 'Pooja', 'Ravi', 'Kiran', 'Deepak', 'Anita', 'Santosh', 'Vijay', 'Rekha', 'Prakash', 'Salim', 'Geeta', 'Manoj'];
  const lastNames = ['Patil', 'Shinde', 'Yadav', 'Khan', 'Pawar', 'Gaikwad', 'Jadhav', 'Sharma', 'More', 'Kale'];
  const workerRows = [];
  for (let index = 1; index <= 32; index += 1) {
    const department = index <= 6 ? 'SPINNING' : index <= 20 ? 'WEAVING' : index <= 28 ? 'DYEING' : null;
    const designation = index % 9 === 0 ? 'Supervisor' : department ? 'Operator' : pick(['Packer', 'Helper', 'Store Assistant']);
    const dailyWage = designation === 'Supervisor' ? 950 : department ? randomBetween(560, 720) : 520;
    workerRows.push([
      `EMP-${String(index).padStart(3, '0')}`,
      `${firstNames[(index * 7) % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`,
      `+91 9${randomBetween(100000000, 999999999)}`,
      department,
      designation,
      dailyWage,
      isoDateOffset(-randomBetween(120, 1500)),
    ]);
  }
  const workers = await insertRows(
    `INSERT INTO workers (employee_code, full_name, phone, department, designation, daily_wage, joined_on) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, department`,
    workerRows,
  );
  const workersFor = (stage) => workers.filter((worker) => worker.department === stage);

  // ------------------------------------------------------------ yarn arriving at the gate
  for (let receiptIndex = 0; receiptIndex < 14; receiptIndex += 1) {
    const lineCount = randomBetween(1, 3);
    const chosenYarns = [...yarnTypes].sort(() => random() - 0.5).slice(0, lineCount);
    await inventoryService.receiveYarn(store, {
      supplierId: pick(suppliers).id,
      vehicleNumber: `MH ${randomBetween(10, 48)} ${pick(['AB', 'CD', 'GT', 'KL'])} ${randomBetween(1000, 9999)}`,
      challanNumber: `CH-${randomBetween(10000, 99999)}`,
      billNumber: `BL-${randomBetween(1000, 9999)}`,
      items: chosenYarns.map((yarn) => ({
        yarnTypeId: yarn.id,
        quantityKg: randomBetween(4, 10) * 100,
        costPerKg: yarnCost[yarn.code] + randomBetween(-12, 12),
      })),
    });
  }

  // ------------------------------------------------------------ orders at every stage of their life
  // progress: 0 new · 1 planned · 2 weaving · 3 woven, in QC · 4 ready · 5 part-dispatched · 6 dispatched
  const orderPlans = [
    { buyer: 0, fabric: 0, colour: 'Sky Blue', meters: 3200, rate: 118, due: -12, progress: 6, paid: 1 },
    { buyer: 1, fabric: 2, colour: 'Indigo', meters: 2400, rate: 265, due: -8, progress: 6, paid: 0.5 },
    { buyer: 2, fabric: 6, colour: 'Khaki', meters: 2800, rate: 172, due: -4, progress: 6, paid: 0 },
    { buyer: 3, fabric: 3, colour: 'White', meters: 3600, rate: 102, due: -2, progress: 5, paid: 1 },
    { buyer: 4, fabric: 4, colour: 'Charcoal Grey', meters: 2200, rate: 238, due: 2, progress: 4 },
    { buyer: 0, fabric: 1, colour: 'Ivory', meters: 1800, rate: 96, due: 4, progress: 4 },
    { buyer: 5, fabric: 5, colour: 'Natural Beige', meters: 1500, rate: 310, due: -1, progress: 3 },
    { buyer: 1, fabric: 0, colour: 'Mint Green', meters: 2600, rate: 121, due: 6, progress: 3 },
    { buyer: 2, fabric: 6, colour: 'Olive', meters: 3000, rate: 168, due: 9, progress: 2 },
    { buyer: 3, fabric: 3, colour: 'Pastel Pink', meters: 4000, rate: 99, due: 12, progress: 2 },
    { buyer: 4, fabric: 4, colour: 'Navy', meters: 2500, rate: 242, due: 15, progress: 2 },
    { buyer: 0, fabric: 2, colour: 'Stone Wash Blue', meters: 2000, rate: 270, due: 18, progress: 2 },
    { buyer: 5, fabric: 1, colour: 'Lemon Yellow', meters: 1600, rate: 94, due: 21, progress: 1 },
    { buyer: 1, fabric: 5, colour: 'Sand', meters: 1200, rate: 305, due: 26, progress: 1 },
    { buyer: 2, fabric: 0, colour: 'Lavender', meters: 3400, rate: 116, due: 30, progress: 0 },
    { buyer: 3, fabric: 3, colour: 'Maroon', meters: 2800, rate: 104, due: 36, progress: 0, priority: 'HIGH' },
  ];

  const busyMachineIds = new Set();
  const freeMachine = (stage) => {
    const machine = machinesByStage(stage).find((candidate) => !busyMachineIds.has(candidate.id));
    if (machine) busyMachineIds.add(machine.id);
    return machine;
  };
  const releaseMachine = (machine) => busyMachineIds.delete(machine.id);

  async function runJob({ orderId, stage, plannedQuantity, outputQuantity, keepRunning }) {
    const machine = freeMachine(stage) ?? machinesByStage(stage)[0];
    const job = await productionService.createJob(floor, { orderId, stage, machineId: machine.id, plannedQuantity });
    if (outputQuantity <= 0) {
      releaseMachine(machine);
      return { job, machine };
    }
    await productionService.changeJobState(floor, job.id, { action: 'start' });
    let remaining = outputQuantity;
    while (remaining > 0) {
      const quantity = Math.min(remaining, randomBetween(stage === 'SPINNING' ? 180 : 380, stage === 'SPINNING' ? 320 : 640));
      await productionService.logProduction(floor, {
        productionJobId: job.id,
        workerId: pick(workersFor(stage)).id,
        shiftId: pick(shifts).id,
        quantityProduced: quantity,
        hoursWorked: 8,
      });
      remaining -= quantity;
    }
    if (!keepRunning) {
      await productionService.changeJobState(floor, job.id, { action: 'complete' });
      releaseMachine(machine);
    }
    return { job, machine };
  }

  for (const plan of orderPlans) {
    const fabric = fabricTypes[plan.fabric];
    const order = await ordersService.createOrder(floor, {
      buyerId: buyers[plan.buyer].id,
      fabricTypeId: fabric.id,
      colour: plan.colour,
      quantityMeters: plan.meters,
      ratePerMeter: plan.rate,
      dueDate: isoDateOffset(plan.due),
      priority: plan.priority ?? (plan.due < 7 ? 'HIGH' : 'NORMAL'),
      notes: plan.progress === 0 ? 'Awaiting lab dip approval from buyer.' : null,
    });
    if (plan.progress === 0) continue;

    // Store issues the yarn this order needs (topping up stock first if the gate is behind).
    const requiredKg = Math.round(plan.meters * fabric.yarn_kg_per_meter);
    const issueKg = plan.progress === 1 ? Math.round(requiredKg / 2) : requiredKg;
    const availability = await inventoryService.checkYarnAvailability({ fabricTypeId: fabric.id, quantityMeters: issueKg / fabric.yarn_kg_per_meter });
    if (!availability.canStart) {
      await inventoryService.receiveYarn(store, {
        supplierId: pick(suppliers).id,
        orderId: order.id,
        vehicleNumber: `PB ${randomBetween(10, 30)} ${randomBetween(1000, 9999)}`,
        items: [{ yarnTypeId: fabric.yarn_type_id, quantityKg: Math.ceil(availability.shortfallKg / 100) * 100 + 500, costPerKg: 280 }],
      });
    }
    await inventoryService.issueYarnToOrder(store, { orderId: order.id, yarnTypeId: fabric.yarn_type_id, quantityKg: issueKg });

    if (plan.progress === 1) {
      await runJob({ orderId: order.id, stage: 'WEAVING', plannedQuantity: plan.meters, outputQuantity: 0 });
      continue;
    }

    const isWeavingDone = plan.progress >= 3;
    const wovenMeters = isWeavingDone ? Math.round(plan.meters * 1.07) + randomBetween(20, 80) : Math.round(plan.meters * (0.25 + random() * 0.5));
    const weaving = await runJob({
      orderId: order.id,
      stage: 'WEAVING',
      plannedQuantity: plan.meters,
      outputQuantity: wovenMeters,
      keepRunning: !isWeavingDone,
    });
    if (isWeavingDone) {
      await runJob({ orderId: order.id, stage: 'DYEING', plannedQuantity: plan.meters, outputQuantity: wovenMeters });
    } else if (machinesByStage('SPINNING').some((machine) => !busyMachineIds.has(machine.id))) {
      // In-house spinning top-up for orders still on the looms.
      await runJob({ orderId: order.id, stage: 'SPINNING', plannedQuantity: randomBetween(6, 9) * 100, outputQuantity: randomBetween(150, 400), keepRunning: true });
    }

    // Cut the woven fabric into rolls.
    const rolls = [];
    let metersLeft = isWeavingDone ? wovenMeters : Math.round(wovenMeters * 0.6);
    while (metersLeft > 30) {
      const length = Math.min(metersLeft, randomBetween(95, 130));
      rolls.push(
        await qualityService.createRoll(floor, {
          orderId: order.id,
          machineId: weaving.machine.id,
          productionJobId: weaving.job.id,
          lengthMeters: length,
          weightKg: Math.round(length * fabric.yarn_kg_per_meter * 10) / 10,
          rackLocation: `R${randomBetween(1, 6)}-${pick(['A', 'B', 'C'])}${randomBetween(1, 9)}`,
        }),
      );
      metersLeft -= length;
    }

    // Inspect. Orders still in QC keep a third of their rolls waiting.
    const rollsToInspect = plan.progress === 3 ? rolls.slice(0, Math.ceil(rolls.length * 0.6)) : plan.progress === 2 ? rolls.slice(0, Math.floor(rolls.length / 2)) : rolls;
    for (const roll of rollsToInspect) {
      const outcome = random();
      if (outcome < 0.08 && plan.progress < 4) {
        await qualityService.inspectRoll(inspector, {
          fabricRollId: roll.id,
          result: 'REWORK',
          remarks: 'Shade variation at selvedge',
          defects: [{ defectType: pick(['COLOUR_MISMATCH', 'STAIN', 'UNEVEN_WEAVING']), occurrences: randomBetween(2, 6) }],
        });
      } else if (outcome >= 0.08 && outcome < 0.11) {
        await qualityService.inspectRoll(inspector, {
          fabricRollId: roll.id,
          result: 'REJECT',
          remarks: 'Multiple holes across width',
          defects: [{ defectType: 'HOLE', occurrences: randomBetween(6, 14) }, { defectType: 'BROKEN_YARN', occurrences: randomBetween(2, 5) }],
        });
      } else {
        const defectCount = randomBetween(0, 3);
        await qualityService.inspectRoll(inspector, {
          fabricRollId: roll.id,
          result: 'PASS',
          grade: defectCount === 0 ? 'A' : defectCount < 3 ? 'A' : 'B',
          defects: defectCount
            ? [{ defectType: pick(['BROKEN_YARN', 'UNEVEN_WEAVING', 'STAIN', 'WIDTH_VARIATION', 'COLOUR_MISMATCH']), occurrences: defectCount }]
            : [],
        });
      }
    }

    // Dispatch and get paid.
    if (plan.progress >= 5) {
      const { rows: passedRolls } = await query(`SELECT id FROM fabric_rolls WHERE order_id = $1 AND status = 'PASSED' ORDER BY id`, [order.id]);
      const truckLoads = plan.progress === 6 ? [passedRolls.slice(0, Math.ceil(passedRolls.length / 2)), passedRolls.slice(Math.ceil(passedRolls.length / 2))] : [passedRolls.slice(0, Math.ceil(passedRolls.length / 2))];
      for (const load of truckLoads.filter((rollsInLoad) => rollsInLoad.length)) {
        const dispatch = await dispatchService.createDispatch(store, {
          orderId: order.id,
          rollIds: load.map((roll) => roll.id),
          vehicleNumber: `MH 04 ${pick(['GH', 'JK', 'TR'])} ${randomBetween(1000, 9999)}`,
          driverName: `${pick(firstNames)} ${pick(lastNames)}`,
          driverPhone: `+91 9${randomBetween(100000000, 999999999)}`,
        });
        const amountToPay = Math.round(dispatch.invoice.total_amount * (plan.paid ?? 0) * 100) / 100;
        if (amountToPay > 0) {
          await financeService.recordBuyerPayment(accounts, {
            invoiceId: dispatch.invoice.id,
            amount: amountToPay,
            method: pick(['BANK_TRANSFER', 'UPI', 'CHEQUE']),
            reference: `UTR${randomBetween(100000000, 999999999)}`,
          });
        }
      }
    }
  }

  // Pay most supplier bills.
  const { rows: bills } = await query('SELECT id, total_amount FROM yarn_receipts ORDER BY id DESC');
  for (const bill of bills.slice(0, Math.floor(bills.length * 0.7))) {
    await financeService.recordSupplierPayment(accounts, { yarnReceiptId: bill.id, amount: bill.total_amount, method: 'BANK_TRANSFER', reference: `NEFT${randomBetween(10000, 99999)}` });
  }

  // A breakdown and a maintenance stop so the floor board shows real life.
  const idleWeaver = machinesByStage('WEAVING').find((machine) => !busyMachineIds.has(machine.id));
  if (idleWeaver) await productionService.changeMachineStatus(floor, idleWeaver.id, { status: 'BREAKDOWN', reason: 'Warp beam bearing failure' });
  const idleDyer = machinesByStage('DYEING').at(-1);
  await productionService.changeMachineStatus(floor, idleDyer.id, { status: 'MAINTENANCE', reason: 'Monthly boiler inspection' });

  // ------------------------------------------------------------ attendance for the last 45 days + payroll
  for (let daysAgo = 45; daysAgo >= 0; daysAgo -= 1) {
    const date = isoDateOffset(-daysAgo);
    if (new Date(date).getDay() === 0) continue; // Sunday off
    await workforceService.markAttendance(floor, {
      date,
      entries: workers.map((worker) => {
        const roll = random();
        const status = roll < 0.86 ? 'PRESENT' : roll < 0.91 ? 'HALF_DAY' : roll < 0.96 ? 'ABSENT' : 'LEAVE';
        return { workerId: worker.id, status, shiftId: pick(shifts).id, overtimeHours: status === 'PRESENT' && random() < 0.15 ? 2 : 0 };
      }),
    });
  }
  const lastMonth = isoDateOffset(-new Date().getDate() - 1).slice(0, 7);
  const lastMonthPayroll = await workforceService.generatePayroll(accounts, { month: lastMonth });
  await workforceService.markPayrollPaid(accounts, lastMonthPayroll.id);
  await workforceService.generatePayroll(accounts, { month: new Date().toISOString().slice(0, 7) });

  // ------------------------------------------------------------ spread timestamps over recent history
  await query(`UPDATE yarn_receipts SET received_at = now() - (id * interval '3 days') - interval '2 hours'`);
  await query(`UPDATE yarn_stock_movements m SET created_at = r.received_at FROM yarn_receipts r WHERE m.yarn_receipt_id = r.id`);
  await query(`UPDATE orders SET created_at = now() - ((20 - id) * interval '1 day' + interval '2 days')`);
  await query(`UPDATE yarn_stock_movements m SET created_at = o.created_at + interval '1 day' FROM orders o WHERE m.order_id = o.id AND m.movement_type = 'ISSUE'`);
  // Leave two yarns close to their reorder level so the low-stock alerts have something to say.
  await query(`UPDATE yarn_types SET reorder_level_kg = round(current_stock_kg * 1.15 + 100) WHERE code IN ('LN-25-NT', 'CT-30-NV')`);
  // Status history in a believable order: one step every ~20 hours after the order arrived.
  await query(`UPDATE order_status_history h SET changed_at = LEAST(now() - interval '10 minutes', o.created_at + (ranked.step - 1) * interval '20 hours')
                 FROM (SELECT id, row_number() OVER (PARTITION BY order_id ORDER BY id) AS step FROM order_status_history) ranked, orders o
                WHERE ranked.id = h.id AND o.id = h.order_id`);
  // At most three 8-hour entries per machine per day, walking back from today.
  await query(`UPDATE production_logs pl SET logged_at = date_trunc('day', now()) - ((ranked.position - 1) / 3) * interval '1 day'
                                                      + interval '6 hours' + ((ranked.position - 1) % 3) * interval '8 hours'
                 FROM (SELECT id, row_number() OVER (PARTITION BY machine_id ORDER BY id DESC) AS position FROM production_logs) ranked
                WHERE ranked.id = pl.id`);
  await query(`UPDATE production_logs SET logged_at = now() - interval '1 hour' WHERE logged_at > now()`);
  await query(`UPDATE quality_inspections SET inspected_at = now() - ((id % 10) * interval '1 day') - interval '3 hours'`);
  await query(`UPDATE dispatches SET dispatched_at = now() - ((id % 12) * interval '1 day') - interval '5 hours'`);
  await query(`UPDATE invoices i SET invoice_date = d.dispatched_at::date, due_date = d.dispatched_at::date + 30 FROM dispatches d WHERE d.invoice_id = i.id`);
  await query(`UPDATE buyer_payments p SET paid_on = LEAST(CURRENT_DATE, i.invoice_date + 6) FROM invoices i WHERE i.id = p.invoice_id`);
  await query(`UPDATE supplier_payments p SET paid_on = (r.received_at + interval '12 days')::date FROM yarn_receipts r WHERE r.id = p.yarn_receipt_id`);
  await query(`UPDATE supplier_payments SET paid_on = CURRENT_DATE WHERE paid_on > CURRENT_DATE`);
  await query(`UPDATE machine_downtimes SET started_at = now() - interval '5 hours' WHERE ended_at IS NULL`);
  await query(`INSERT INTO machine_downtimes (machine_id, reason, started_at, ended_at)
               SELECT id, 'Shed change-over', now() - interval '6 days', now() - interval '6 days' + interval '3 hours'
                 FROM machines WHERE stage = 'WEAVING' LIMIT 3`);

}

// ------------------------------------------------------------------ platform
const logoDataUrl = async (name) =>
  `data:image/png;base64,${(await readFile(new URL(`./logos/${name}-logo.png`, import.meta.url))).toString('base64')}`;

/** A smaller mill: a few yarns, machines and buyers so the super admin console has variety. */
async function seedSmallMill({ yarns, machines, buyers, staff }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const [fullName, email, role] of staff) {
    await query('INSERT INTO users (full_name, email, password_hash, role, activated_at) VALUES ($1, $2, $3, $4, now())', [fullName, email, passwordHash, role]);
  }
  await insertRows(`INSERT INTO yarn_types (code, name, material, yarn_count, colour, reorder_level_kg) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, yarns);
  await insertRows(`INSERT INTO machines (code, name, stage, hourly_running_cost, location) VALUES ($1, $2, $3, $4, $5) RETURNING id`, machines);
  await insertRows(`INSERT INTO buyers (company_name, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING id`, buyers);
  await query(`UPDATE users SET last_login_at = now() - interval '2 hours' WHERE role = 'OWNER'`);
}

async function seed() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test fixtures only load into the test database (NODE_ENV=test).');
  const { rows: existing } = await query('SELECT count(*) AS organization_count FROM platform.organizations');
  if (existing[0].organization_count > 0) {
    console.log('Test database already has data.');
    return;
  }
  await query(`INSERT INTO platform.platform_admins (full_name, email, password_hash) VALUES ('Platform Admin', 'admin@millos.in', $1)`, [
    await bcrypt.hash(DEMO_PASSWORD, 12),
  ]);

  const everest = await registerOrganization(
    {
      organization: { name: 'Everest Textile Mills', city: 'Bhiwandi, Maharashtra', phone: '+91 22 2765 4400', gstNumber: '27AABCE1234F1Z5', logo: await logoDataUrl('everest') },
      owner: { fullName: 'Rajesh Agarwal', email: 'owner@everestmills.in', password: DEMO_PASSWORD },
    },
    { ip: '127.0.0.1', organizationCode: 'EVE-K7M2Q' },
  );
  await runInTenantSchema(everest.schemaName, seedEverestMill);

  const smallMills = [
    {
      code: 'SHR-4HT8P', name: 'Shree Ganesh Spinners', city: 'Ichalkaranji, Maharashtra', logo: 'ganesh', owner: ['Ganesh Kulkarni', 'owner@ganeshspinners.in'], daysAgo: 24,
      staff: [['Prakash Mane', 'floor@ganeshspinners.in', 'PRODUCTION_MANAGER']],
      yarns: [['CT-30-RW', 'Carded Cotton 30s', 'Cotton', '30s', 'Raw White', 600], ['CT-40-RW', 'Combed Cotton 40s', 'Cotton', '40s', 'Raw White', 500]],
      machines: [['RF-01', 'Ring Frame LR-6', 'SPINNING', 410, 'Unit 1'], ['RF-02', 'Ring Frame LR-6', 'SPINNING', 410, 'Unit 1'], ['OE-01', 'Open-End Rotor R-60', 'SPINNING', 380, 'Unit 2']],
      buyers: [['Kolhapur Weavers Co-op', 'Sanjay Patil', '+91 98220 10101', 'buy@kolhapurweavers.example', 'Kolhapur']],
    },
    {
      code: 'KAV-9RW3D', name: 'Kaveri Dyeing House', city: 'Tiruppur, Tamil Nadu', logo: 'kaveri', owner: ['Lakshmi Narayanan', 'owner@kaveridyeing.in'], daysAgo: 41, suspended: 'Subscription payment overdue by 30 days.',
      staff: [['Murugan S', 'process@kaveridyeing.in', 'PRODUCTION_MANAGER'], ['Divya R', 'qc@kaveridyeing.in', 'QUALITY_INSPECTOR']],
      yarns: [['CT-34-RW', 'Combed Cotton 34s', 'Cotton', '34s', 'Raw White', 400]],
      machines: [['JD-01', 'Jet Dyeing Thies 400', 'DYEING', 600, 'Process House'], ['JG-01', 'Jigger J-1200', 'DYEING', 420, 'Process House']],
      buyers: [['Tiruppur Knits Export', 'Arun Kumar', '+91 94430 22334', 'sourcing@tiruppurknits.example', 'Tiruppur']],
    },
    {
      code: 'NAR-6PB2K', name: 'Narmada Weaves', city: 'Surat, Gujarat', logo: null, owner: ['Hetal Desai', 'owner@narmadaweaves.in'], daysAgo: 2,
      staff: [], yarns: [], machines: [], buyers: [],
    },
  ];
  for (const mill of smallMills) {
    const created = await registerOrganization(
      {
        organization: { name: mill.name, city: mill.city, logo: mill.logo ? await logoDataUrl(mill.logo) : undefined },
        owner: { fullName: mill.owner[0], email: mill.owner[1], password: DEMO_PASSWORD },
      },
      { ip: '127.0.0.1', organizationCode: mill.code },
    );
    await runInTenantSchema(created.schemaName, () => seedSmallMill(mill));
    await query(`UPDATE platform.organizations SET created_at = now() - make_interval(days => $2) WHERE id = $1`, [created.organizationId, mill.daysAgo]);
    if (mill.suspended) {
      await query(`UPDATE platform.organizations SET status = 'SUSPENDED', suspended_reason = $2, suspended_at = now() - interval '3 days' WHERE id = $1`, [created.organizationId, mill.suspended]);
      await query(`INSERT INTO platform.platform_events (organization_id, event_type, actor_email, details, created_at)
                   VALUES ($1, 'ORGANIZATION_SUSPENDED', 'admin@millos.in', jsonb_build_object('reason', $2::text), now() - interval '3 days')`, [created.organizationId, mill.suspended]);
    }
  }

  // Spread platform history so the console's charts and feed look lived-in.
  await query(`UPDATE platform.organizations SET created_at = now() - interval '62 days' WHERE organization_code = 'EVE-K7M2Q'`);
  await query(`UPDATE platform.platform_events e SET created_at = o.created_at FROM platform.organizations o
                WHERE o.id = e.organization_id AND e.event_type = 'ORGANIZATION_SIGNED_UP'`);
  const { rows: everestPeople } = await runInTenantSchema(everest.schemaName, () => query('SELECT email, role FROM users WHERE activated_at IS NOT NULL'));
  for (let day = 0; day < 7; day += 1) {
    for (const person of everestPeople) {
      if (random() < 0.35) continue;
      await query(`INSERT INTO platform.platform_events (organization_id, event_type, actor_email, details, ip_address, created_at)
                   VALUES ($1, 'SIGNED_IN', $2, jsonb_build_object('role', $3::text), '10.0.4.21', date_trunc('day', now()) - make_interval(days => $4) + make_interval(hours => $5))`,
        [everest.organizationId, person.email, person.role, day, randomBetween(6, 11)]);
    }
  }
  await query(`INSERT INTO platform.platform_events (organization_id, event_type, actor_email, ip_address, created_at)
               VALUES ($1, 'SIGN_IN_FAILED', 'store@everestmills.in', '10.0.4.33', now() - interval '26 hours'),
                      ($1, 'PASSWORD_RESET_REQUESTED', 'store@everestmills.in', '10.0.4.33', now() - interval '25 hours'),
                      ($1, 'PASSWORD_RESET_COMPLETED', 'store@everestmills.in', '10.0.4.33', now() - interval '25 hours' + interval '3 minutes'),
                      ($1, 'USER_INVITED', 'owner@everestmills.in', NULL, now() - interval '5 hours')`, [everest.organizationId]);

}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
