"""Add demo persistence

Revision ID: 4307d38d0943
Revises: 962db81207e2
Create Date: 2026-10-10 22:20:32.575305

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4307d38d0943'
down_revision: Union[str, Sequence[str], None] = '962db81207e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('demo_sessions',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('start_time', sa.DateTime(), nullable=True),
    sa.Column('end_time', sa.DateTime(), nullable=True),
    sa.Column('status', sa.String(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demo_sessions_id'), 'demo_sessions', ['id'], unique=False)
    
    op.create_table('demo_measurements',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.String(), nullable=False),
    sa.Column('timestamp', sa.DateTime(), nullable=True),
    sa.Column('north_queue', sa.Integer(), nullable=True),
    sa.Column('south_queue', sa.Integer(), nullable=True),
    sa.Column('east_queue', sa.Integer(), nullable=True),
    sa.Column('west_queue', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['session_id'], ['demo_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demo_measurements_id'), 'demo_measurements', ['id'], unique=False)

    op.create_table('demo_decisions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.String(), nullable=False),
    sa.Column('timestamp', sa.DateTime(), nullable=True),
    sa.Column('selected_phase', sa.String(), nullable=False),
    sa.Column('reason', sa.String(), nullable=False),
    sa.Column('duration', sa.Integer(), nullable=False),
    sa.Column('north_queue_input', sa.Integer(), nullable=True),
    sa.Column('south_queue_input', sa.Integer(), nullable=True),
    sa.Column('east_queue_input', sa.Integer(), nullable=True),
    sa.Column('west_queue_input', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['session_id'], ['demo_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demo_decisions_id'), 'demo_decisions', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_demo_decisions_id'), table_name='demo_decisions')
    op.drop_table('demo_decisions')
    op.drop_index(op.f('ix_demo_measurements_id'), table_name='demo_measurements')
    op.drop_table('demo_measurements')
    op.drop_index(op.f('ix_demo_sessions_id'), table_name='demo_sessions')
    op.drop_table('demo_sessions')
