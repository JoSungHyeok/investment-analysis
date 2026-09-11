"""로그인 사용자별 모의투자 계좌 API.

실제 증권사 주문은 전혀 전송하지 않으며 MongoDB에 교육용 가상현금, 보유자산,
거래이력만 저장한다. auth 라우터에서 build_router(current_user)로 등록한다.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

try:
    from ..db import get_db
except ImportError:
    from db import get_db

INITIAL_CASH = 100_000_000.0
HISTORY_LIMIT = 200
ASSETS = {
    "005930": {"symbol": "005930", "name": "삼성전자", "type": "주식", "reference_price": 79_000.0},
    "000660": {"symbol": "000660", "name": "SK하이닉스", "type": "주식", "reference_price": 285_000.0},
    "035420": {"symbol": "035420", "name": "NAVER", "type": "주식", "reference_price": 235_000.0},
    "005380": {"symbol": "005380", "name": "현대차", "type": "주식", "reference_price": 226_000.0},
    "BTC": {"symbol": "BTC", "name": "비트코인", "type": "코인", "reference_price": 155_000_000.0},
    "ETH": {"symbol": "ETH", "name": "이더리움", "type": "코인", "reference_price": 6_400_000.0},
    "XRP": {"symbol": "XRP", "name": "리플", "type": "코인", "reference_price": 4_200.0},
}


class PaperOrderRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    side: str = Field(pattern=r"^(BUY|SELL)$")
    quantity: float = Field(gt=0, le=1_000_000_000)
    price: float = Field(gt=0, le=1_000_000_000_000)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_account(user_id) -> dict:
    return {
        "user_id": user_id,
        "cash": INITIAL_CASH,
        "positions": {},
        "history": [],
        "version": 0,
        "created_at": _now(),
        "updated_at": _now(),
    }


async def _get_account(user_id) -> dict:
    collection = get_db().paper_accounts
    await collection.create_index("user_id", unique=True)
    account = await collection.find_one({"user_id": user_id})
    if account:
        return account
    account = _new_account(user_id)
    try:
        await collection.insert_one(account)
        return account
    except DuplicateKeyError:
        return await collection.find_one({"user_id": user_id})


def _serialize(account: dict) -> dict:
    positions = []
    for position in account.get("positions", {}).values():
        item = deepcopy(position)
        item["quantity"] = float(item.get("quantity", 0))
        item["avgPrice"] = float(item.pop("avg_price", 0))
        item["lastPrice"] = float(item.pop("last_price", item["avgPrice"]))
        positions.append(item)

    history = []
    for row in account.get("history", []):
        item = deepcopy(row)
        at = item.get("at")
        if isinstance(at, datetime):
            item["at"] = at.isoformat()
        history.append(item)

    return {
        "cash": float(account.get("cash", INITIAL_CASH)),
        "positions": positions,
        "history": history,
        "version": int(account.get("version", 0)),
        "assets": list(ASSETS.values()),
    }


def build_router(current_user: Callable) -> APIRouter:
    router = APIRouter(prefix="/paper", tags=["모의투자"])

    @router.get("/account")
    async def paper_account(user: dict = Depends(current_user)) -> dict:
        return _serialize(await _get_account(user["_id"]))

    @router.post("/orders", status_code=status.HTTP_201_CREATED)
    async def paper_order(request: PaperOrderRequest, user: dict = Depends(current_user)) -> dict:
        symbol = request.symbol.strip().upper()
        asset = ASSETS.get(symbol)
        if not asset:
            raise HTTPException(status_code=422, detail="지원하지 않는 모의투자 종목입니다.")

        collection = get_db().paper_accounts
        for _ in range(4):
            account = await _get_account(user["_id"])
            version = int(account.get("version", 0))
            cash = float(account.get("cash", INITIAL_CASH))
            positions = deepcopy(account.get("positions", {}))
            history = deepcopy(account.get("history", []))
            current = deepcopy(positions.get(symbol, {
                "symbol": symbol,
                "name": asset["name"],
                "type": asset["type"],
                "quantity": 0.0,
                "avg_price": 0.0,
                "last_price": request.price,
            }))
            quantity = float(request.quantity)
            price = float(request.price)
            amount = quantity * price

            if request.side == "BUY":
                if amount > cash + 1e-9:
                    raise HTTPException(status_code=409, detail="보유 가상현금이 부족합니다.")
                previous_quantity = float(current.get("quantity", 0))
                previous_avg = float(current.get("avg_price", 0))
                new_quantity = previous_quantity + quantity
                current["avg_price"] = ((previous_avg * previous_quantity) + amount) / new_quantity
                current["quantity"] = new_quantity
                current["last_price"] = price
                positions[symbol] = current
                cash -= amount
            else:
                held = float(current.get("quantity", 0))
                if quantity > held + 1e-9:
                    raise HTTPException(status_code=409, detail="보유 수량보다 많이 매도할 수 없습니다.")
                remaining = held - quantity
                cash += amount
                if remaining <= 1e-9:
                    positions.pop(symbol, None)
                else:
                    current["quantity"] = remaining
                    current["last_price"] = price
                    positions[symbol] = current

            history.insert(0, {
                "at": _now(),
                "side": request.side,
                "symbol": symbol,
                "name": asset["name"],
                "type": asset["type"],
                "quantity": quantity,
                "price": price,
                "amount": amount,
            })
            history = history[:HISTORY_LIMIT]

            result = await collection.update_one(
                {"user_id": user["_id"], "version": version},
                {"$set": {"cash": cash, "positions": positions, "history": history, "updated_at": _now()}, "$inc": {"version": 1}},
            )
            if result.modified_count == 1:
                saved = await collection.find_one({"user_id": user["_id"]})
                return {"message": f"{asset['name']} {'매수' if request.side == 'BUY' else '매도'} 모의 체결", "account": _serialize(saved)}

        raise HTTPException(status_code=409, detail="동시에 여러 주문이 처리되어 계좌가 변경되었습니다. 다시 시도해 주세요.")

    @router.post("/reset")
    async def paper_reset(user: dict = Depends(current_user)) -> dict:
        collection = get_db().paper_accounts
        await collection.update_one(
            {"user_id": user["_id"]},
            {"$set": {"cash": INITIAL_CASH, "positions": {}, "history": [], "updated_at": _now()}, "$inc": {"version": 1}},
            upsert=True,
        )
        return _serialize(await collection.find_one({"user_id": user["_id"]}))

    return router
